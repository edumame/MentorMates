import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { meetingId } = await request.json();
  const workerUrl = process.env.SCREEN_VISION_WORKER_URL;
  if (!workerUrl) {
    return NextResponse.json(
      { error: "SCREEN_VISION_WORKER_URL is not set" },
      { status: 500 }
    );
  }
  const response = await fetch(
    `${workerUrl.replace(/\/$/, "")}/session/pause`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId }),
    }
  );
  return NextResponse.json(await response.json());
}
