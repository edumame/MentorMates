"use client";

// shipcue's uploadVideo hook: ask /api/shipcue/video for a signed upload, send
// the video straight to Supabase Storage, then confirm so it is linked to the
// report. Keeps big recordings off the server function.
import { videoType } from "shipcue";
import { supabase } from "@/lib/supabase";
import { SHIPCUE_BUCKET } from "@/lib/shipcue/config";

const ENDPOINT = "/api/shipcue/video";

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  return typeof body.error === "string" && body.error ? body.error : fallback;
}

export async function uploadReportVideo(reportId: string, video: Blob): Promise<void> {
  const type = videoType(video.type);
  if (!type) throw new Error("Attach a WebM, MP4 or MOV video.");
  const headers = { "content-type": "application/json" };

  const start = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ reportId, type, size: video.size }),
  });
  if (!start.ok) throw new Error(await readError(start, "Could not upload the video."));
  const { path, token } = (await start.json()) as { path: string; token: string };

  const { error } = await supabase.storage
    .from(SHIPCUE_BUCKET)
    .uploadToSignedUrl(path, token, video, { contentType: type });
  if (error) throw new Error("Could not upload the video.");

  const done = await fetch(ENDPOINT, {
    method: "PUT",
    headers,
    body: JSON.stringify({ reportId, path }),
  });
  if (!done.ok) throw new Error(await readError(done, "Could not attach the video."));
}
