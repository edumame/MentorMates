import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import {
  MessageNewEvent,
  CallEndedEvent,
  CallRecordingReadyEvent,
  CallTranscriptionReadyEvent,
  CallSessionParticipantLeftEvent,
  CallSessionStartedEvent,
  CustomVideoEvent,
} from "@stream-io/node-sdk";
import { createSupabaseServiceClient } from "@/app/utils/supabase/server";
import { streamVideo } from "@/lib/stream-video";
import { inngest } from "@/lib/inngest/client";
// import { generateAvatarUri } from "@/lib/avatar";
// import { streamChat } from "@/lib/stream-chat";

const openaiClient = new OpenAI();

const processedMessages = new Set<string>();

function verifySignatureWithSDK(body: string, signature: string): boolean {
  return streamVideo.verifyWebhook(body, signature);
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServiceClient();
  const signature = req.headers.get("x-signature");
  const apiKey = req.headers.get("x-api-key");

  if (!signature || !apiKey) {
    return NextResponse.json(
      { error: "Missing signature or API key" },
      { status: 400 }
    );
  }

  const body = await req.text();

  if (!verifySignatureWithSDK(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = (payload as Record<string, unknown>)?.type;

  if (eventType === "call.session_started") {
    const event = payload as CallSessionStartedEvent;
    const meetingId = event.call.custom?.meetingId;

    if (!meetingId) {
      return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
    }

    const { data: existingMeeting, error: meetingError } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meetingId)
      .eq("status", "upcoming")
      .maybeSingle();

    if (meetingError || !existingMeeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    await supabase
      .from("meetings")
      .update({
        status: "active",
        started_at: new Date().toISOString(),
      })
      .eq("id", existingMeeting.id);

    const { data: existingAgent, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("id", existingMeeting.agent_id)
      .maybeSingle();

    if (agentError || !existingAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Compute Stream callId (real call identifier) and keep meetingId for DB lookups
    type CallReference = { call_cid?: string; call?: { id?: string } };
    const callRef = event as unknown as CallReference;
    const callId = callRef.call_cid?.split(":")[1] || callRef.call?.id;

    // If the meeting is linked to a project, fetch project title and description
    let projectContext = "";
    try {
      if (existingMeeting.project_id) {
        const { data: projectRow, error: projectError } = await supabase
          .from("projects")
          .select("project_name, project_description")
          .eq("id", existingMeeting.project_id)
          .maybeSingle();

        if (!projectError && projectRow) {
          const title = projectRow.project_name || "";
          const desc = projectRow.project_description || "";
          projectContext = `\n\nHere is the project context from the student:\nTitle: ${title}\nDescription: ${desc}`;
        }
      }
    } catch {
      projectContext = "";
      return NextResponse.json({ error: "Project not found" }, { status: 400 });
    }

    const instructions = `${existingAgent.instructions || ""}${projectContext}`;

    // Delegate OpenAI realtime session management to external worker
    const workerUrl = process.env.SCREEN_VISION_WORKER_URL;
    if (!workerUrl) {
      return NextResponse.json(
        { error: "Missing SCREEN_VISION_WORKER_URL" },
        { status: 500 }
      );
    }

    try {
      const resp = await fetch(
        `${workerUrl.replace(/\/$/, "")}/session/start`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            meetingId,
            callId,
            agentUserId: existingAgent.id,
            instructions,
          }),
        }
      );

      if (!resp.ok) {
        const text = await resp.text().catch(() => "<no body>");
        console.error("worker /session/start failed", {
          meetingId,
          callId,
          status: resp.status,
          body: text,
        });
      }
    } catch (e) {
      console.error("failed to call worker /session/start", {
        meetingId,
        callId,
        err: String(e),
      });
    }

    // worker will update session with instructions and start polling
  } else if (eventType === "call.session_participant_left") {
    const event = payload as CallSessionParticipantLeftEvent;
    const meetingId = event.call_cid.split(":")[1];

    const call = streamVideo.video.call("default", meetingId);
    await call.end();
    try {
      const workerUrl2 = process.env.SCREEN_VISION_WORKER_URL;
      if (workerUrl2) {
        await fetch(`${workerUrl2.replace(/\/$/, "")}/session/stop`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ meetingId }),
        });
      }
    } catch (e) {
      console.warn("failed to notify worker about participant_left", e);
    }
  } else if (eventType === "call.session_ended") {
    const event = payload as CallEndedEvent;
    const meetingId = event.call.custom?.meetingId;

    if (!meetingId) {
      return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
    }

    await supabase
      .from("meetings")
      .update({
        status: "processing",
        ended_at: new Date().toISOString(),
      })
      .eq("id", meetingId)
      .eq("status", "active");

    try {
      const workerUrl3 = process.env.SCREEN_VISION_WORKER_URL;
      if (workerUrl3) {
        await fetch(`${workerUrl3.replace(/\/$/, "")}/session/stop`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ meetingId }),
        });
      }
    } catch (e) {
      console.warn("failed to notify worker about session_ended", e);
    }
  } else if (eventType === "call.transcription_ready") {
    const event = payload as CallTranscriptionReadyEvent;
    const meetingId = event.call_cid.split(":")[1];

    const { data: updatedMeeting, error: updateError } = await supabase
      .from("meetings")
      .update({ transcript_url: event.call_transcription.url })
      .eq("id", meetingId)
      .select()
      .maybeSingle();

    if (updateError || !updatedMeeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    await inngest.send({
      name: "meetings/processing",
      data: {
        meetingId: updatedMeeting.id,
        transcriptUrl: updatedMeeting.transcript_url,
        agentId: updatedMeeting.agent_id,
      },
    });
  } else if (eventType === "call.recording_ready") {
    const event = payload as CallRecordingReadyEvent;
    const meetingId = event.call_cid.split(":")[1];

    await supabase
      .from("meetings")
      .update({ recording_url: event.call_recording.url })
      .eq("id", meetingId);
  } else if (eventType === "custom") {
    console.log("reaching custom")
    const event = payload as CustomVideoEvent;
    const meetingId = event.call_cid.split(":")[1];

    if (event.custom.type === "agent_pause") {
      try {
        const workerUrl = process.env.SCREEN_VISION_WORKER_URL;
        if (workerUrl) {
          await fetch(`${workerUrl.replace(/\/$/, "")}/session/pause`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ meetingId }),
          });
        }
      } catch (e) {
        console.warn("failed to notify worker about session_ended", e);
      }
    } else if (event.custom.type === "agent_resume") {
      try {
        const workerUrl = process.env.SCREEN_VISION_WORKER_URL;
        if (workerUrl) {
          await fetch(`${workerUrl.replace(/\/$/, "")}/session/resume`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ meetingId }),
          });
        }
      } catch (e) {
        console.warn("failed to notify worker about session_resume", e);
      }
    }
  }
  // else if (eventType === "message.new") {
  //     const event = payload as MessageNewEvent;

  //     const userId = event.user?.id;
  //     const channelId = event.channel_id;
  //     const text = event.message?.text;
  //     const messageId = event.message?.id;

  //     if (!messageId) {
  //         return NextResponse.json({ status: "ignored_no_id" });
  //     }

  //     if (processedMessages.has(messageId)) {
  //         return NextResponse.json({ status: "duplicate_ignored" });
  //     }
  //     processedMessages.add(messageId);

  //     if (!userId || !channelId || !text) {
  //         return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  //     }

  //     const { data: existingMeeting, error: meetingError2 } = await supabase
  //         .from("meetings")
  //         .select("*")
  //         .eq("id", channelId)
  //         .eq("status", "completed")
  //         .maybeSingle();

  //     if (meetingError2 || !existingMeeting) {
  //         return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  //     }

  //     const { data: existingAgent, error: agentError2 } = await supabase
  //         .from("agents")
  //         .select("*")
  //         .eq("id", existingMeeting.agent_id)
  //         .maybeSingle();

  //     if (agentError2 || !existingAgent) {
  //         return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  //     }

  //     if (userId !== existingAgent.id) {
  //         const instructions = `
  //             You are an AI assistant helping the user revisit a recently completed meeting.
  //             Below is a summary of the meeting, generated from the transcript:

  //             ${existingMeeting.summary}

  //             The following are your original instructions from the live meeting assistant. Please continue to follow these behavioral guidelines as you assist the user:

  //             ${existingAgent.instructions}

  //             The user may ask questions about the meeting, request clarifications, or ask for follow-up actions.
  //             Always base your responses on the meeting summary above.

  //             You also have access to the recent conversation history between you and the user. Use the context of previous messages to provide relevant, coherent, and helpful responses. If the user's question refers to something discussed earlier, make sure to take that into account and maintain continuity in the conversation.

  //             If the summary does not contain enough information to answer a question, politely let the user know.

  //             Be concise, helpful, and focus on providing accurate information from the meeting and the ongoing conversation.
  //         `;

  //         const channel = streamChat.channel("messaging", channelId);
  //         await channel.watch();

  //         type StreamMessage = { text?: string; user?: { id?: string } };
  //         const previousMessages = channel.state.messages.slice(-5).filter((msg: StreamMessage) => msg.text && msg.text.trim() !== "")
  //             .map<ChatCompletionMessageParam>((message: StreamMessage) => ({
  //                 role: message.user?.id === existingAgent.id ? "assistant" : "user",
  //                 content: message.text || "",
  //             }));

  //         const GPTResponse = await openaiClient.chat.completions.create({
  //             messages: [
  //                 { role: "system", content: instructions },
  //                 ...previousMessages,
  //                 { role: "user", content: text },
  //             ],
  //             model: "gpt-4o",
  //         });

  //         const GPTResponseText = GPTResponse.choices[0].message.content;

  //         if (!GPTResponseText) {
  //             return NextResponse.json({ error: "No response from GPT" }, { status: 400 });
  //         }

  //         const avatarUrl = generateAvatarUri({ seed: existingAgent.name, variant: "botttsNeutral" });

  //         streamChat.upsertUser({
  //             id: existingAgent.id,
  //             name: existingAgent.name,
  //             image: avatarUrl,
  //         });

  //         channel.sendMessage({
  //             text: GPTResponseText,
  //             user: {
  //                 id: existingAgent.id,
  //                 name: existingAgent.name,
  //                 image: avatarUrl,
  //             },
  //         });
  //     }
  // };

  return NextResponse.json({ status: "ok" });
}
