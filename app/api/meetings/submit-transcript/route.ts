import { NextRequest, NextResponse } from "next/server";
import { streamChat } from "@/lib/stream-chat";
import { createSupabaseServiceClient } from "@/app/utils/supabase/server";
import { inngest } from "@/lib/inngest/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const meetingId = body?.meetingId;

    if (!meetingId) {
      return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
    }

    const supabase = await createSupabaseServiceClient();

    const { data: meetingRow, error: meetingError } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meetingId)
      .maybeSingle();

    if (meetingError || !meetingRow) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Fetch recent messages from Stream Chat channel for this meeting
    try {
      const channel = streamChat.channel("messaging", meetingId);
      await channel.watch();
      const { messages } = await channel.query({ messages: { limit: 200 } });

      // Build JSONL transcript lines with speaker_id and text only.
      // Example line: {"speaker_id":"<id>","text":"Hello."}
      type StreamMessage = { text?: string | null; user?: { id?: string; name?: string } };

      const transcriptLines = (messages || [])
        .map((m) => m as StreamMessage)
        .filter((m) => !!(m.text && m.text.toString().trim()))
        .map((m) => {
          const speakerId = m.user?.id || m.user?.name || "unknown";
          const text = (m.text || "").toString();
          return JSON.stringify({ speaker_id: speakerId, text });
        });

      const transcriptText = transcriptLines.join("\n");
      // Update meeting to processing and set ended_at if missing
      await supabase
        .from("meetings")
        .update({ status: "processing", ended_at: meetingRow.ended_at || new Date().toISOString() })
        .eq("id", meetingId);

      // Send to inngest to trigger the same processing pipeline as session end
      await inngest.send({
        name: "meetings/processing",
        data: {
          meetingId,
          // provide JSONL transcript that inngest pipeline can parse
          transcriptText,
          agentId: meetingRow.agent_id,
        },
      });

      return NextResponse.json({ status: "ok" });
    } catch (e) {
      console.error("failed to fetch channel messages", e);
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }
  } catch (e) {
    console.error("Invalid request", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
