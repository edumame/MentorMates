import { NextRequest, NextResponse } from "next/server";
import { authorizeMeetingRequest } from "@/lib/meetings/route-access";
import { screenVisionWorkerHeaders } from "@/lib/screen-vision-worker";

export async function POST(request: NextRequest) {
  try {
    const access = await authorizeMeetingRequest(request);
    if (access.response) return access.response;

    const workerUrl = process.env.SCREEN_VISION_WORKER_URL;
    if (!workerUrl) {
      return NextResponse.json({ error: "SCREEN_VISION_WORKER_URL is not set" }, { status: 500 });
    }
    const response = await fetch(`${workerUrl.replace(/\/$/, "")}/session/resume`, {
      method: "POST",
      headers: screenVisionWorkerHeaders(),
      body: JSON.stringify({ meetingId: access.meeting.id }),
    });
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Voice agent resume failed", error);
    return NextResponse.json({ error: "Unable to resume agent" }, { status: 500 });
  }
}
