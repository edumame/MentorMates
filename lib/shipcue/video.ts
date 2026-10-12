// A report's video goes from the browser straight to Supabase Storage: a
// screen recording is far bigger than a Vercel function may receive (4.5 MB).
// POST hands the reporter a signed upload for their own report; PUT checks the
// upload landed and links it to the report. Same rules as shipcue's own video
// endpoint: the reporter only, once, within 30 minutes of filing.
import { formatBytes, videoExtension, videoType, type Report } from "shipcue";
import type { ReportStore } from "shipcue/server";
import { SHIPCUE_PREFIX, VIDEO_WINDOW_MS, shipcueConfig } from "@/lib/shipcue/config";
import { reporterOf, type ShipcueUser } from "@/lib/shipcue/handler";

export interface VideoDeps {
  store: ReportStore;
  getUser: () => Promise<ShipcueUser | null>;
  /** A signed upload for this storage path; returns the token the browser uploads with. */
  createUpload: (path: string) => Promise<{ token: string }>;
  /** The stored object's size in bytes, or null if it is not there. */
  objectSize: (path: string) => Promise<number | null>;
  publicUrl: (path: string) => string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const fail = (error: string, status = 400) => json({ error }, status);

export const videoPath = (reportId: string, ext: string) => `${SHIPCUE_PREFIX}/${reportId}/video.${ext}`;

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

/** The report, if the signed-in user filed it and may still add a video. */
async function ownReport(
  deps: VideoDeps,
  reportId: unknown
): Promise<{ report: Report } | { error: Response }> {
  if (typeof reportId !== "string") return { error: fail("Bad request") };
  const user = await deps.getUser().catch(() => null);
  if (!user) return { error: fail("Sign in to attach a video.", 401) };
  const report = await deps.store.get(reportId);
  if (!report) return { error: fail("No such report", 404) };
  if (report.reporter === null || report.reporter !== reporterOf(user)) {
    return { error: fail("Not your report.", 403) };
  }
  if (Date.now() - Date.parse(report.createdAt) > VIDEO_WINDOW_MS) {
    return { error: fail("Too late to add a video to this report.", 403) };
  }
  if (report.video) return { error: fail("This report already has a video.", 409) };
  return { report };
}

/** POST { reportId, type, size } → { path, token } */
export async function startVideoUpload(req: Request, deps: VideoDeps): Promise<Response> {
  const body = await readBody(req);
  const type = typeof body.type === "string" ? videoType(body.type) : null;
  if (!type) return fail("Attach a WebM, MP4 or MOV video.");
  const size = typeof body.size === "number" && Number.isInteger(body.size) ? body.size : 0;
  if (size <= 0) return fail("The video is empty.");
  if (size > shipcueConfig.maxVideoBytes) {
    return fail(`Videos can be up to ${formatBytes(shipcueConfig.maxVideoBytes)}.`);
  }
  const own = await ownReport(deps, body.reportId);
  if ("error" in own) return own.error;

  const path = videoPath(own.report.id, videoExtension(type));
  try {
    const { token } = await deps.createUpload(path);
    return json({ path, token });
  } catch (err) {
    console.error("shipcue: video upload start failed", err);
    return fail("Could not upload the video.", 502);
  }
}

/** PUT { reportId, path } → { report } once the upload is in storage. */
export async function finishVideoUpload(req: Request, deps: VideoDeps): Promise<Response> {
  const body = await readBody(req);
  const own = await ownReport(deps, body.reportId);
  if ("error" in own) return own.error;
  const allowed = ["webm", "mp4", "mov"].map((ext) => videoPath(own.report.id, ext));
  if (typeof body.path !== "string" || !allowed.includes(body.path)) return fail("Bad request");

  const size = await deps.objectSize(body.path).catch(() => null);
  if (size === null) return fail("The video did not upload. Please try again.", 409);
  if (size > shipcueConfig.maxVideoBytes) {
    return fail(`Videos can be up to ${formatBytes(shipcueConfig.maxVideoBytes)}.`);
  }
  const saved = await deps.store.attachVideo(own.report.id, deps.publicUrl(body.path));
  return saved ? json({ report: saved }) : fail("This report already has a video.", 409);
}
