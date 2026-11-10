import { NextResponse } from "next/server";
import { authorizeMeetingRequest } from "@/lib/meetings/route-access";
import { workerHeaders } from "@/lib/meetings/worker";

export async function POST(request: Request) {
  try {
    const access = await authorizeMeetingRequest(request);
    if (access.response) return access.response;
    const workerUrl = process.env.SCREEN_VISION_WORKER_URL;
    if (!workerUrl) throw new Error("Worker unavailable");
    const response = await fetch(`${workerUrl.replace(/\/$/, "")}/session/pause`, {
      method: "POST", headers: workerHeaders(),
      body: JSON.stringify({ meetingId: access.meeting.id }), signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return NextResponse.json({ error: "Worker operation failed" }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Voice control unavailable" }, { status: 502 });
  }
}
