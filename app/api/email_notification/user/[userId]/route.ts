import { NextResponse, NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  getCheckinQRCodeEmail,
  getEventScheduleUpdateNotificationEmail,
  getEventUpdateNotificationEmail,
} from "@/lib/email_templates/event-notifications";
import { EMAIL_TYPES, NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import { EventRole, type EventDetails } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null as unknown as Resend;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { eventId, emailType } = await request.json();
  if (!eventId || !emailType) {
    return NextResponse.json(
      { error: "Event ID and email type are required" },
      { status: 400 }
    );
  }

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }
  const supabase = await createSupabaseClient();
  const serviceSupabase = createSupabaseServiceClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // This route sends from the MentorMates domain to an address resolved with
  // the service client, so a session alone must not be enough to use it.
  if (user.id !== userId) {
    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: isAdmin } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });

    const isOrganizer =
      roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Organizer);
    if (!isOrganizer && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: targetRow } = await serviceSupabase
    .from("user_event_roles")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!targetRow) {
    return NextResponse.json(
      { error: "User not found for this event" },
      { status: 404 }
    );
  }

  const { data: eventData } = await serviceSupabase
    .from("events")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();

  if (!eventData) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data: userEmail, error: emailError } = await serviceSupabase
    .from("user_profiles")
    .select("email")
    .eq("uid", userId)
    .single();

  if (emailError) {
    return NextResponse.json(
      { error: "Failed to fetch user email" },
      { status: 500 }
    );
  }

  if (!userEmail?.email) {
    return NextResponse.json(
      { error: "User email not found" },
      { status: 404 }
    );
  }

  const emailToSend = await getUserEmail({
    userId,
    eventId,
    emailType,
    eventData: eventData as unknown as EventDetails,
  });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  const { data, error } = await resend.emails.send({
    from: NOTIFICATIONS_EMAIL_FROM,
    to: userEmail.email,
    subject: emailToSend.subject,
    html: emailToSend.html,
  });

  if (error) {
    return NextResponse.json({ error: "Error sending email" }, { status: 500 });
  }

  return NextResponse.json({ message: "Email sent successfully", data: data }, { status: 200 });
}

const getUserEmail = async ({
  userId,
  eventId,
  emailType,
  eventData,
}: {
  userId: string;
  eventId: string;
  emailType: EMAIL_TYPES;
  eventData: EventDetails;
}) => {
  const resolvedEventName = eventData.event_name || "Event";

  switch (emailType) {
    case EMAIL_TYPES.CHECKIN_QR_CODE:
      return await getCheckinQRCodeEmail(resolvedEventName, userId, eventId);
    case EMAIL_TYPES.EVENT_UPDATE:
      return getEventUpdateNotificationEmail(
        resolvedEventName,
        eventId,
        eventData
      );
    case EMAIL_TYPES.EVENT_SCHEDULE_UPDATE:
      return getEventScheduleUpdateNotificationEmail(
        resolvedEventName,
        eventId,
        eventData
      );
    default:
      // Fallback to a simple check-in email if unknown type
      return await getCheckinQRCodeEmail(resolvedEventName, userId, eventId);
  }
};
