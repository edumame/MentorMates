import { NextResponse } from "next/server";
import { VIDEO_SOURCES } from "@/lib/config/video-sources";

export async function GET() {
  return NextResponse.json({
    source: "static",
    videos: VIDEO_SOURCES,
  });
}
