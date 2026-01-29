import { NextResponse } from "next/server";
import { ROLE_VIDEO_KEYS, ROLE_VIDEOS, VIDEO_SOURCES } from "@/lib/config/video-sources";

/**
 * Tutorials endpoint (static for now).
 *
 * Today:
 * - Returns the centralized tutorial config from `lib/config/video-sources.ts`.
 *
 * Later:
 * - This can be upgraded to sync from the Notion “Tutorial Videos” database,
 *   but the rest of the app can keep calling `/api/tutorials`.
 */
export async function GET() {
  return NextResponse.json({
    sources: VIDEO_SOURCES,
    roleVideoKeys: ROLE_VIDEO_KEYS,
    roleVideos: ROLE_VIDEOS,
  });
}

