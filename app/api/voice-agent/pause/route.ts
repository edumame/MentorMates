import { NextResponse } from "next/server";
import { authorizeMeetingRequest } from "@/lib/meetings/route-access";
import { workerControlResult, workerHeaders } from "@/lib/meetings/worker";

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
    const result = await workerControlResult(response);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Voice control unavailable" }, { status: 502 });
  }
}
