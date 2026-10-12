// Direct-to-storage video uploads for shipcue reports. See lib/shipcue/video.ts.
import { finishVideoUpload, startVideoUpload } from "@/lib/shipcue/video";
import { videoDeps } from "@/lib/shipcue/server";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return startVideoUpload(req, videoDeps());
}

export function PUT(req: Request) {
  return finishVideoUpload(req, videoDeps());
}
