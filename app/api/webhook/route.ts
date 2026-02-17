import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
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
import { streamChat } from "@/lib/stream-chat";

const openaiClient = new OpenAI();

const processedMessages = new Set<string>();

const CHAT_RESPONSES_MODEL = process.env.OPENAI_RESPONSES_MODEL || "gpt-5.2";
const CHAT_ENABLE_WEB_SEARCH =
  process.env.OPENAI_CHAT_ENABLE_WEB_SEARCH !== "false";
const DEFAULT_FILE_SEARCH_VECTOR_STORE_IDS = parseCsvEnv(
  process.env.OPENAI_FILE_SEARCH_VECTOR_STORE_IDS
);
const CHAT_TOOL_CHOICE = resolveToolChoice(
  process.env.OPENAI_CHAT_TOOL_CHOICE,
  "required"
);
const CHAT_LOG_TOOL_CALLS = process.env.OPENAI_CHAT_LOG_TOOL_CALLS === "true";
const MAX_ATTACHMENT_INPUTS = normalizePositiveInt(
  Number.parseInt(process.env.OPENAI_CHAT_MAX_ATTACHMENT_INPUTS || "3", 10),
  3
);

type ChatHistoryMessage = {
  role: "assistant" | "user";
  content: string;
};

type StreamChannelMessage = {
  text?: string;
  user?: { id?: string };
};

type StreamWebhookMessage = {
  id?: string;
  text?: string;
  attachments?: unknown[];
};

type StreamWebhookAttachment = {
  type?: string;
  asset_url?: string;
  image_url?: string;
  title_link?: string;
  name?: string;
};

type UserAttachmentInput =
  | { type: "input_image"; image_url: string; detail: "auto" }
  | { type: "input_file"; file_url: string; filename?: string };

type ResponseInputContentItem =
  | { type: "input_text"; text: string }
  | UserAttachmentInput;

type ResponseInputItem = {
  role: "system" | "assistant" | "user";
  content: ResponseInputContentItem[];
};

type ResponseCreateParams = Parameters<typeof openaiClient.responses.create>[0];
type ResponseTool = NonNullable<ResponseCreateParams["tools"]>[number];

function inputText(text: string): { type: "input_text"; text: string } {
  return { type: "input_text", text };
}

function buildResponsesInput(
  systemInstructions: string,
  previousMessages: ChatHistoryMessage[],
  userText: string,
  userAttachments: UserAttachmentInput[]
): ResponseInputItem[] {
  const historyItems: ResponseInputItem[] = previousMessages.map(
    (message): ResponseInputItem => ({
      role: message.role,
      content: [inputText(message.content)],
    })
  );

  return [
    {
      role: "system",
      content: [inputText(systemInstructions)],
    },
    ...historyItems,
    {
      role: "user",
      content: [inputText(userText), ...userAttachments],
    },
  ];
}

function extractResponseText(response: unknown): string {
  const responseRecord = response as Record<string, unknown>;
  if (typeof responseRecord.output_text === "string") {
    return responseRecord.output_text.trim();
  }

  if (!Array.isArray(responseRecord.output)) {
    return "";
  }

  const chunks: string[] = [];
  for (const outputItem of responseRecord.output) {
    const outputRecord = outputItem as Record<string, unknown> | null;
    if (!outputRecord || !Array.isArray(outputRecord.content)) continue;

    for (const contentItem of outputRecord.content) {
      const contentRecord = contentItem as Record<string, unknown> | null;
      if (!contentRecord) continue;
      if (typeof contentRecord.text === "string") {
        chunks.push(contentRecord.text);
        continue;
      }
      if (typeof contentRecord.value === "string") {
        chunks.push(contentRecord.value);
      }
    }
  }

  return chunks.join(" ").trim();
}

async function createTextResponse(params: {
  systemInstructions: string;
  previousMessages: ChatHistoryMessage[];
  userText: string;
  userAttachments: UserAttachmentInput[];
}): Promise<string> {
  const tools = buildResponseTools();

  const requestBody: Parameters<typeof openaiClient.responses.create>[0] = {
    model: CHAT_RESPONSES_MODEL,
    input: buildResponsesInput(
      params.systemInstructions,
      params.previousMessages,
      params.userText,
      params.userAttachments
    ),
    ...(tools.length > 0
      ? {
          tools,
          tool_choice: CHAT_TOOL_CHOICE,
        }
      : {}),
  };

  const response = await openaiClient.responses.create(requestBody);
  if (CHAT_LOG_TOOL_CALLS) {
    const toolCalls = extractToolCalls(response);
    console.log("chat tool calls", toolCalls);
  }

  return extractResponseText(response);
}

function parseCsvEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizePositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function resolveToolChoice(
  rawValue: string | undefined,
  fallback: "auto" | "required" | "none"
): "auto" | "required" | "none" {
  const candidate = (rawValue || "").trim().toLowerCase();
  if (candidate === "auto") return "auto";
  if (candidate === "required") return "required";
  if (candidate === "none") return "none";
  return fallback;
}

function extractToolCalls(response: unknown): string[] {
  const record = response as Record<string, unknown>;
  if (!Array.isArray(record.output)) return [];

  const result: string[] = [];
  for (const outputItem of record.output) {
    if (!outputItem || typeof outputItem !== "object") continue;
    const item = outputItem as Record<string, unknown>;
    if (typeof item.type !== "string") continue;
    if (item.type.endsWith("_call")) {
      result.push(item.type);
    }
  }
  return result;
}

function normalizeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function buildAttachmentInputs(
  rawAttachments: unknown
): UserAttachmentInput[] {
  if (!Array.isArray(rawAttachments)) return [];

  const outputs: UserAttachmentInput[] = [];
  const seenUrls = new Set<string>();

  for (const rawAttachment of rawAttachments) {
    if (outputs.length >= MAX_ATTACHMENT_INPUTS) break;
    if (!rawAttachment || typeof rawAttachment !== "object") continue;

    const attachment = rawAttachment as StreamWebhookAttachment;
    const attachmentType =
      typeof attachment.type === "string"
        ? attachment.type.toLowerCase()
        : undefined;

    const imageUrl =
      normalizeHttpUrl(attachment.image_url) ||
      (attachmentType === "image"
        ? normalizeHttpUrl(attachment.asset_url)
        : null);

    if (imageUrl && !seenUrls.has(imageUrl)) {
      outputs.push({
        type: "input_image",
        image_url: imageUrl,
        detail: "auto",
      });
      seenUrls.add(imageUrl);
      continue;
    }

    if (
      attachmentType === "video" ||
      attachmentType === "audio" ||
      attachmentType === "voice_recording"
    ) {
      continue;
    }

    const fileUrl =
      normalizeHttpUrl(attachment.asset_url) ||
      normalizeHttpUrl(attachment.title_link);
    if (!fileUrl || seenUrls.has(fileUrl)) continue;

    const fileInput: UserAttachmentInput = {
      type: "input_file",
      file_url: fileUrl,
    };
    if (typeof attachment.name === "string" && attachment.name.trim().length) {
      fileInput.filename = attachment.name.trim();
    }

    outputs.push(fileInput);
    seenUrls.add(fileUrl);
  }

  return outputs;
}

function buildResponseTools(): ResponseTool[] {
  const tools: ResponseTool[] = [];

  if (CHAT_ENABLE_WEB_SEARCH) {
    tools.push({ type: "web_search_preview" });
  }

  if (DEFAULT_FILE_SEARCH_VECTOR_STORE_IDS.length > 0) {
    tools.push({
      type: "file_search",
      vector_store_ids: DEFAULT_FILE_SEARCH_VECTOR_STORE_IDS,
    });
  }

  return tools;
}

function verifySignatureWithSDK(body: string, signature: string): boolean {
  return streamVideo.verifyWebhook(body, signature);
}

type CallReference = {
  call_cid?: string;
  call?: { id?: string; custom?: { meetingId?: string } };
};

function resolveMeetingId(callRef: CallReference): string | null {
  const fromCustom = callRef.call?.custom?.meetingId;
  if (fromCustom) return fromCustom;

  const fromCallCid = callRef.call_cid?.split(":")[1];
  if (fromCallCid) return fromCallCid;

  return callRef.call?.id ?? null;
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
    const callRef = event as unknown as CallReference;
    const meetingId = resolveMeetingId(callRef);

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
            voice: existingAgent.voice ?? undefined,
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
    const meetingId = resolveMeetingId(event as unknown as CallReference);

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
        console.warn("failed to notify worker about session_paused", e);
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
  else if (eventType === "message.new") {
      const event = payload as MessageNewEvent;
      const message = (event.message || {}) as StreamWebhookMessage;

      const userId = event.user?.id;
      const channelId = event.channel_id;
      const text = (message.text || "").trim();
      const messageId = message.id;
      const userAttachments = buildAttachmentInputs(message.attachments);

      if (!messageId) {
          return NextResponse.json({ status: "ignored_no_id" });
      }

      if (processedMessages.has(messageId)) {
          return NextResponse.json({ status: "duplicate_ignored" });
      }
      processedMessages.add(messageId);

      if (!userId || !channelId || (!text && userAttachments.length === 0)) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const userText =
        text || "Please analyze the attached file(s) and answer the request.";

      const { data: existingUpcomingMeeting } = await supabase
        .from("meetings")
        .select("*")
        .eq("id", channelId)
        .eq("status", "upcoming")
        .maybeSingle();

      // Start a chat at the Chat with agent page
      if (existingUpcomingMeeting) {
        const { data: existingAgent, error: agentError } = await supabase
            .from("agents")
            .select("*")
            .eq("id", existingUpcomingMeeting.agent_id)
            .maybeSingle();

        if (agentError || !existingAgent) {
            return NextResponse.json({ error: "Agent not found from upcoming meeting" }, { status: 404 });
        }

        if (userId !== existingAgent.id) {
          const channel = streamChat.channel("messaging", channelId);
          await channel.watch();

          const { messages: recentMessages } = await channel.query({ messages: { limit: 5 } });
          const previousMessages = ((recentMessages || []) as StreamChannelMessage[])
            .filter((msg) => !!msg?.text && msg.text.trim() !== "")
            .map<ChatHistoryMessage>((message) => ({
              role: message.user?.id === existingAgent.id ? "assistant" : "user",
              content: message.text || "",
            }));

          const GPTResponseText = await createTextResponse({
              systemInstructions: existingAgent.instructions || "",
              previousMessages,
              userText,
              userAttachments,
          });

          if (!GPTResponseText) {
              return NextResponse.json({ error: "No response from GPT" }, { status: 400 });
          }

          streamChat.upsertUser({
              id: existingAgent.id,
              name: existingAgent.name,
              image: existingAgent.avatar_url,
          });

          channel.sendMessage({
              text: GPTResponseText,
              user: {
                  id: existingAgent.id,
                  name: existingAgent.name,
                  image: existingAgent.avatar_url,
              },
          });
        }
        // Start a chat at the Feedback page
      } else { 
        const { data: existingMeeting, error: meetingError2 } = await supabase
          .from("meetings")
          .select("*")
          .eq("id", channelId)
          .eq("status", "completed")
          .maybeSingle();

        if (meetingError2 || !existingMeeting) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        const { data: existingAgent, error: agentError2 } = await supabase
            .from("agents")
            .select("*")
            .eq("id", existingMeeting.agent_id)
            .maybeSingle();

        if (agentError2 || !existingAgent) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }

        if (userId !== existingAgent.id) {
          const instructions = `
              You are an AI assistant helping the user revisit a recently completed meeting.
              Below is a summary of the meeting, generated from the transcript:

              ${existingMeeting.summary}

              The following are your original instructions from the live meeting assistant. Please continue to follow these behavioral guidelines as you assist the user:

              ${existingAgent.instructions}

              The user may ask questions about the meeting, request clarifications, or ask for follow-up actions.
              Always base your responses on the meeting summary above.

              You also have access to the recent conversation history between you and the user. Use the context of previous messages to provide relevant, coherent, and helpful responses. If the user's question refers to something discussed earlier, make sure to take that into account and maintain continuity in the conversation.

              If the summary does not contain enough information to answer a question, politely let the user know.

              Be concise, helpful, and focus on providing accurate information from the meeting and the ongoing conversation.
          `;

          const channel = streamChat.channel("messaging", channelId);
          await channel.watch();

          const { messages: recentMessages } = await channel.query({ messages: { limit: 5 } });
          const previousMessages = ((recentMessages || []) as StreamChannelMessage[])
            .filter((msg) => !!msg?.text && msg.text.trim() !== "")
            .map<ChatHistoryMessage>((message) => ({
              role: message.user?.id === existingAgent.id ? "assistant" : "user",
              content: message.text || "",
            }));

          const GPTResponseText = await createTextResponse({
              systemInstructions: instructions,
              previousMessages,
              userText,
              userAttachments,
          });

          if (!GPTResponseText) {
              return NextResponse.json({ error: "No response from GPT" }, { status: 400 });
          }

          streamChat.upsertUser({
              id: existingAgent.id,
              name: existingAgent.name,
              image: existingAgent.avatar_url,
          });

          channel.sendMessage({
              text: GPTResponseText,
              user: {
                  id: existingAgent.id,
                  name: existingAgent.name,
                  image: existingAgent.avatar_url,
              },
          });
        }
      }
  };

  return NextResponse.json({ status: "ok" });
}
