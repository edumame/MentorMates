// Server-only pieces for shipcue: the session, the admin check, the store,
// storage uploads and the team email. Used by app/api/shipcue/**.
import "server-only";
import { Resend } from "resend";
import { buildBody, buildTitle, type Report } from "shipcue";
import type { ReportStore } from "shipcue/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import { SHIPCUE_BUCKET, SHIPCUE_PREFIX, shipcueConfig } from "@/lib/shipcue/config";
import { supabaseStore } from "@/lib/shipcue/supabase-store";
import type { ShipcueDeps, ShipcueUser } from "@/lib/shipcue/handler";
import type { VideoDeps } from "@/lib/shipcue/video";

const DEFAULT_NOTIFY = "contact@mentormates.ai";

export async function currentUser(): Promise<ShipcueUser | null> {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const supabase = await createSupabaseClient();
  const { data } = await supabase.rpc("is_admin_user", { user_id: userId });
  return Boolean(data);
}

let store: ReportStore | null = null;
/** Created on first use so builds and tests do not need Supabase env vars. */
export function shipcueStore(): ReportStore {
  return (store ??= supabaseStore(createSupabaseServiceClient()));
}

export function storagePath(key: string): string {
  return `${SHIPCUE_PREFIX}/${key}`;
}

export async function saveToBucket(file: File, key: string): Promise<string> {
  const storage = createSupabaseServiceClient().storage.from(SHIPCUE_BUCKET);
  const path = storagePath(key);
  const { error } = await storage.upload(path, file, { contentType: file.type });
  if (error) throw new Error(`Screenshot upload failed: ${error.message}`);
  return storage.getPublicUrl(path).data.publicUrl;
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Emails the team about a new report, as /api/bug-reports did. Skipped without RESEND_API_KEY. */
export async function notifyTeam(report: Report): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const to = (process.env.BUG_REPORT_NOTIFY_EMAILS ?? DEFAULT_NOTIFY)
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const text = buildBody(report, shipcueConfig);
  await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: NOTIFICATIONS_EMAIL_FROM,
    to,
    subject: `[MentorMates] ${buildTitle(report, shipcueConfig)}`,
    text,
    html: `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(text)}</pre>`,
  });
}

export function shipcueDeps(): ShipcueDeps {
  return {
    store: shipcueStore(),
    getUser: currentUser,
    isAdmin: isAdminUser,
    agentToken: process.env.SHIPCUE_TOKEN,
    saveScreenshot: saveToBucket,
    onReport: notifyTeam,
  };
}

export function videoDeps(): VideoDeps {
  const bucket = () => createSupabaseServiceClient().storage.from(SHIPCUE_BUCKET);
  return {
    store: shipcueStore(),
    getUser: currentUser,
    async createUpload(path) {
      // upsert: a retry after a failed upload may reuse the same path.
      const { data, error } = await bucket().createSignedUploadUrl(path, { upsert: true });
      if (error || !data) throw new Error(error?.message ?? "no signed upload");
      return { token: data.token };
    },
    async objectSize(path) {
      const { data, error } = await bucket().info(path);
      if (error || !data) return null;
      return typeof data.size === "number" ? data.size : 0;
    },
    publicUrl: (path) => bucket().getPublicUrl(path).data.publicUrl,
  };
}
