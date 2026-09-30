import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  createSupabaseClient,
  createSupabaseServiceClient,
} from "@/app/utils/supabase/server";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import {
  buildReportBody,
  buildReportEmail,
  buildReportTitle,
  isReportCategory,
  isReportPriority,
  isReportType,
} from "@/lib/bugs";

const SCREENSHOT_BUCKET = "project-materials";
const SCREENSHOT_PREFIX = "bug-reports";
const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const DEFAULT_NOTIFY = "contact@mentormates.ai";

/**
 * Files a bug report or feature request: stores it in `bug_reports`,
 * uploads screenshots to storage, and emails the team. Auth required.
 * Takes multipart FormData so screenshots can ride along.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();

    const description = String(form.get("description") ?? "").trim();
    if (description.length < 10) {
      return NextResponse.json(
        { error: "Tell us a little more (at least 10 characters)." },
        { status: 400 }
      );
    }
    if (description.length > 4000) {
      return NextResponse.json(
        { error: "Keep the report under 4,000 characters." },
        { status: 400 }
      );
    }

    const type = String(form.get("type") ?? "bug");
    const priority = String(form.get("priority") ?? "medium");
    const category = String(form.get("category") ?? "other");
    if (!isReportType(type)) {
      return NextResponse.json({ error: "Pick bug or feature request." }, { status: 400 });
    }
    if (!isReportPriority(priority)) {
      return NextResponse.json({ error: "Pick a priority." }, { status: 400 });
    }
    if (!isReportCategory(category)) {
      return NextResponse.json({ error: "Pick a category." }, { status: 400 });
    }

    const pageUrl = String(form.get("pageUrl") ?? "").slice(0, 500);
    const userAgent = String(form.get("userAgent") ?? "").slice(0, 300);

    const files = form
      .getAll("screenshot")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_SCREENSHOTS) {
      return NextResponse.json(
        { error: `Up to ${MAX_SCREENSHOTS} screenshots.` },
        { status: 400 }
      );
    }
    for (const f of files) {
      if (!IMAGE_TYPES[f.type]) {
        return NextResponse.json(
          { error: "Screenshots must be PNG, JPG, WebP or GIF." },
          { status: 400 }
        );
      }
      if (f.size > MAX_SCREENSHOT_BYTES) {
        return NextResponse.json(
          { error: "Each screenshot must be under 5 MB." },
          { status: 400 }
        );
      }
    }

    const service = await createSupabaseServiceClient();
    const id = crypto.randomUUID();

    const screenshotUrls: string[] = [];
    for (const [i, f] of files.entries()) {
      const key = `${SCREENSHOT_PREFIX}/${id}/${i + 1}.${IMAGE_TYPES[f.type]}`;
      const { error: uploadError } = await service.storage
        .from(SCREENSHOT_BUCKET)
        .upload(key, f, { contentType: f.type });
      if (uploadError) {
        return NextResponse.json(
          { error: `Screenshot upload failed: ${uploadError.message}` },
          { status: 500 }
        );
      }
      const {
        data: { publicUrl },
      } = service.storage.from(SCREENSHOT_BUCKET).getPublicUrl(key);
      screenshotUrls.push(publicUrl);
    }

    const reporter =
      (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Unknown";
    const title = buildReportTitle(type, priority, category, description);

    const { error: insertError } = await service.from("bug_reports").insert([
      {
        id,
        reporter_id: user.id,
        reporter_email: user.email ?? null,
        type,
        priority,
        category,
        title,
        description: buildReportBody({
          type,
          priority,
          category,
          description,
          screenshotUrls,
          reporter,
          pageUrl,
          userAgent,
        }),
        page_url: pageUrl || null,
        user_agent: userAgent || null,
        screenshot_urls: screenshotUrls,
      },
    ]);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Tell the team by email too; a mail failure never fails the report.
    try {
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const recipients = (process.env.BUG_REPORT_NOTIFY_EMAILS ?? DEFAULT_NOTIFY)
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
        const { subject, text, html } = buildReportEmail({
          type,
          priority,
          category,
          description,
          reporter,
          pageUrl,
          screenshotUrls,
        });
        await resend.emails.send({
          from: NOTIFICATIONS_EMAIL_FROM,
          to: recipients,
          subject,
          text,
          html,
        });
      }
    } catch (emailError) {
      console.error("Bug report notification failed:", emailError);
    }

    return NextResponse.json({ id });
  } catch (err) {
    console.error("Bug report failed:", err);
    return NextResponse.json(
      { error: "Could not send the report. Please try again." },
      { status: 500 }
    );
  }
}
