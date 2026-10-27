import { NextRequest, NextResponse } from "next/server";
import { streamChat } from "@/lib/stream-chat";
import { inngest } from "@/lib/inngest/client";
import { authorizeMeetingRequest } from "@/lib/meetings/route-access";

export async function POST(req: NextRequest) {
  try {
    const access = await authorizeMeetingRequest(req);
    if (access.response) return access.response;
    const { service, meeting } = access;
    if (meeting.status === "processing" || meeting.status === "completed") {
      return NextResponse.json({ status: meeting.status }, { status: 202 });
    }
    if (meeting.status !== "upcoming") {
      return NextResponse.json({ error: "Meeting cannot be submitted in its current state" }, { status: 409 });
    }

    // One winner even when multiple requests read the same upcoming meeting.
    const claimedAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await service.from("meetings")
      .update({ status: "processing", ended_at: meeting.ended_at || claimedAt, updated_at: claimedAt })
      .eq("id", meeting.id).eq("status", "upcoming").select("id").maybeSingle();
    if (claimError) throw new Error("Unable to claim meeting processing");
    if (!claimed) return NextResponse.json({ error: "Meeting state changed; refresh before retrying" }, { status: 409 });

    let transcriptText: string;
    try {
      const channel = streamChat.channel("messaging", meeting.id);
      const { messages } = await channel.query({ messages: { limit: 200 } });
      transcriptText = (messages || [])
        .filter((message) => typeof message.text === "string" && message.text.trim())
        .map((message) => JSON.stringify({
          speaker_id: message.user?.id || message.user?.name || "unknown",
          text: message.text,
        })).join("\n");
      if (!transcriptText) throw new Error("No transcript messages available");
    } catch {
      // Safe to release only before dispatch; never undo another completed job.
      const { data: released, error: releaseError } = await service.from("meetings")
        .update({ status: "upcoming", ended_at: meeting.ended_at, updated_at: meeting.updated_at })
        .eq("id", meeting.id).eq("status", "processing").eq("updated_at", claimedAt)
        .select("id").maybeSingle();
      if (releaseError || !released) {
        return NextResponse.json({ error: "Transcript unavailable; processing state requires reconciliation" }, { status: 503 });
      }
      return NextResponse.json({ error: "No transcript available; retry after messages are available" }, { status: 503 });
    }

    try {
      await inngest.send({
        id: `meeting-transcript-${meeting.id}`,
        name: "meetings/processing",
        data: { meetingId: meeting.id, transcriptText, agentId: meeting.agent_id },
      });
    } catch {
      // Delivery may have succeeded despite a transport error. Retain the claim
      // for reconciliation instead of enabling duplicate work with a rollback.
      // Operators must inspect the deterministic event ID in Inngest before
      // retrying delivery or resetting status; event deduplication is time-limited.
      return NextResponse.json({ error: "Processing delivery is uncertain; reconciliation required" }, { status: 503 });
    }
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Transcript submission failed", error);
    return NextResponse.json({ error: "Unable to submit transcript" }, { status: 500 });
  }
}
