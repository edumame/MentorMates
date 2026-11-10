import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { canAccessRole } from "@/features/user/roles/roles";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import { sendEventInviteEmails } from "@/lib/events/invite-emails";
import { reserveInviteQuota } from "@/lib/email/invite-quota";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole, EventVisibility } from "@/lib/types";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  const { eventId, email } = await request.json();

  if (!auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!eventId || !email) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 }
    );
  }

  const { data: userRole } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  let isAllowed = false;
  if (
    userRole &&
    canAccessRole(userRole.role as EventRole, EventRole.Organizer)
  ) {
    isAllowed = true;
  } else {
    const { data: isAdmin } = await supabase.rpc("is_admin_user", {
      user_id: auth.user.id,
    });
    isAllowed = Boolean(isAdmin);
  }

  if (!isAllowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: eventData } = await supabase
    .from("events")
    .select("event_name, slug, visibility")
    .eq("event_id", eventId)
    .single();

  if (!eventData) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data: inviterProfile } = await supabase
    .from("user_profiles")
    .select("email, display_name")
    .eq("uid", auth.user.id)
    .single();

  const inviterName =
    inviterProfile?.display_name?.trim() ||
    inviterProfile?.email?.trim() ||
    "A MentorMates organizer";

  // ORG-012 / MENT-008: never grant the judge role here. Every invitee,
  // existing account or not, receives a signed invitation and becomes a judge
  // only after accepting it while signed in with this email
  // (app/api/events/[eventId]/accept-invite).
  const resend = getResend();
  if (!resend) {
    return NextResponse.json(
      { error: "Email is not configured (RESEND_API_KEY missing)" },
      { status: 503 }
    );
  }

  // ORG-012: per-inviter and per-event daily caps.
  const quotaResponse = await reserveInviteQuota(
    createSupabaseServiceClient(),
    auth.user.id,
    eventId
  );
  if (quotaResponse) return quotaResponse;

  const summary = await sendEventInviteEmails({
    appOrigin: process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin,
    eventId,
    eventName: eventData.event_name,
    eventSlug: eventData.slug,
    inviterName,
    visibility:
      (eventData.visibility as EventVisibility | null) ?? EventVisibility.Draft,
    judgeInviteEmails: [normalizedEmail],
    deferIfDraft: false,
    sendEmail: async ({ to, subject, html }) => {
      try {
        const { error } = await resend.emails.send({
          from: NOTIFICATIONS_EMAIL_FROM,
          to,
          subject,
          html,
        });

        if (error) {
          console.error("Failed to send judge invitation email:", error);
          return false;
        }

        return true;
      } catch (emailError) {
        console.error("Error sending judge invitation email:", emailError);
        return false;
      }
    },
  });

  if (summary.sent.judge !== 1) {
    return NextResponse.json(
      { error: "Failed to send invitation email" },
      { status: 500 }
    );
  }

  // Uniform response: whether the address has an account is not disclosed.
  return NextResponse.json({ success: true });
}
