import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import {
  EvidenceLetterData,
  generateEvidenceLetterPdf,
  safeFileName,
} from "@/features/user/dashboards/dashboard/organizer/roles/generateLetterPdf";

const resend = new Resend(process.env.RESEND_API_KEY);

let cachedLogoDataUrl: string | undefined;

function getLogoDataUrl(): string | undefined {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl || undefined;
  try {
    const logoPath = path.join(process.cwd(), "public", "mentormate.png");
    const buffer = fs.readFileSync(logoPath);
    cachedLogoDataUrl = `data:image/png;base64,${buffer.toString("base64")}`;
    return cachedLogoDataUrl;
  } catch (err) {
    console.error("Failed to read MentorMates logo from disk", err);
    cachedLogoDataUrl = "";
    return undefined;
  }
}

const ALLOWED_ROLES = new Set<EventRole>([EventRole.Judge, EventRole.Mentor]);

interface EmailLetterBody {
  letterData: EvidenceLetterData;
  coverNote?: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCoverHtml(
  data: EvidenceLetterData,
  coverNote: string | undefined
): string {
  const note =
    coverNote && coverNote.trim().length > 0
      ? `<p style="margin:0 0 16px 0;">${escapeHtml(coverNote).replace(/\n/g, "<br/>")}</p>`
      : "";
  return `<!doctype html>
<html><body style="font-family:Helvetica,Arial,sans-serif;color:#111;font-size:14px;line-height:1.6;">
  <p style="margin:0 0 16px 0;">Hi ${escapeHtml(data.recipientName) || "there"},</p>
  <p style="margin:0 0 16px 0;">
    Attached is a signed evidence letter from <strong>${escapeHtml(data.organizerName) || "the organizing team"}</strong> validating your service as a ${escapeHtml(data.roleNoun)} at
    <strong>${escapeHtml(data.eventName)}</strong>${data.eventDate ? ` on ${escapeHtml(data.eventDate)}` : ""}.
    Use this letter as supporting documentation for visa packets (e.g. O1) or any other third-party verification.
  </p>
  ${note}
  <p style="margin:0 0 16px 0;">Thank you again for your time and service.</p>
  <p style="margin:24px 0 4px 0;color:#666;font-size:12px;">Sent on behalf of ${escapeHtml(data.organizerName) || "MentorMates"} via MentorMates.</p>
  <p style="margin:0;color:#999;font-size:11px;">Powered by MentorMates · mentormates.ai</p>
</body></html>`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; userId: string }> }
) {
  try {
    const { eventId, userId } = await params;
    const supabase = await createSupabaseClient();
    const serviceSupabase = createSupabaseServiceClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: isAdminRpc } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });
    const isAdmin = Boolean(isAdminRpc);
    const isOrganizer =
      roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Organizer);

    if (!isOrganizer && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: targetRole } = await serviceSupabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!targetRole || !ALLOWED_ROLES.has(targetRole.role as EventRole)) {
      return NextResponse.json(
        {
          error:
            "Target user is not a judge or mentor for this event",
        },
        { status: 400 }
      );
    }

    const { data: targetProfile } = await serviceSupabase
      .from("user_profiles")
      .select("display_name, email")
      .eq("uid", userId)
      .maybeSingle();

    if (!targetProfile?.email) {
      return NextResponse.json(
        { error: "Recipient has no email on file" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as EmailLetterBody;
    if (!body?.letterData) {
      return NextResponse.json(
        { error: "Missing letterData in request body" },
        { status: 400 }
      );
    }

    if (
      body.letterData.roleNoun !== "judge" &&
      body.letterData.roleNoun !== "mentor"
    ) {
      return NextResponse.json(
        { error: "Invalid roleNoun in letterData" },
        { status: 400 }
      );
    }

    const expectedRole =
      body.letterData.roleNoun === "judge" ? EventRole.Judge : EventRole.Mentor;
    if (targetRole.role !== expectedRole) {
      return NextResponse.json(
        {
          error: `Letter role (${body.letterData.roleNoun}) does not match recipient role (${targetRole.role})`,
        },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Email service is not configured" },
        { status: 500 }
      );
    }

    const doc = generateEvidenceLetterPdf({
      ...body.letterData,
      logoDataUrl: body.letterData.logoDataUrl ?? getLogoDataUrl(),
    });
    const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
    const pdfBuffer = Buffer.from(arrayBuffer);

    const filename = `evidence-letter-${body.letterData.roleNoun}-${safeFileName(body.letterData.recipientName)}-${safeFileName(body.letterData.eventName)}.pdf`;

    const { error: sendError } = await resend.emails.send({
      from: NOTIFICATIONS_EMAIL_FROM,
      to: targetProfile.email,
      subject: `Your evidence letter from ${body.letterData.eventName || "MentorMates"}`,
      html: buildCoverHtml(body.letterData, body.coverNote),
      attachments: [
        {
          filename,
          content: pdfBuffer,
        },
      ],
    });

    if (sendError) {
      console.error("Resend error sending evidence letter", sendError);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      sentTo: targetProfile.email,
      filename,
    });
  } catch (error) {
    console.error("Error in POST email-evidence-letter route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
