import { NextRequest, NextResponse } from "next/server";
import { authorizeMeetingId } from "@/lib/meetings/route-access";
import { screenVisionWorkerHeaders } from "@/lib/screen-vision-worker";

export const dynamic = "force-dynamic";
// The browser's EventSource reconnects when the platform ends a long response.
export const maxDuration = 300;

/** Authorized proxy for the worker's caption stream, which only accepts the server. */
export async function GET(request: NextRequest) {
  try {
    const access = await authorizeMeetingId(request.nextUrl.searchParams.get("meetingId"));
    if (access.response) return access.response;

    const workerUrl = process.env.SCREEN_VISION_WORKER_URL;
    if (!workerUrl) {
      return NextResponse.json({ error: "SCREEN_VISION_WORKER_URL is not set" }, { status: 500 });
    }

    const upstream = await fetch(
      `${workerUrl.replace(/\/$/, "")}/captions/stream?meetingId=${access.meeting.id}`,
      { headers: screenVisionWorkerHeaders(), signal: request.signal }
    );
    if (!upstream.ok || !upstream.body) {
      console.error("worker /captions/stream failed", { status: upstream.status });
      return NextResponse.json({ error: "Captions unavailable" }, { status: 502 });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        // no-transform keeps response compression from buffering the stream.
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Voice agent captions failed", error);
    return NextResponse.json({ error: "Captions unavailable" }, { status: 502 });
  }
}
