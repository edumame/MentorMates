import { NextResponse, NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  getCheckinQRCodeEmail,
  getEventScheduleUpdateNotificationEmail,
  getEventUpdateNotificationEmail,
} from "@/lib/email_templates/event-notifications";
import { EMAIL_TYPES, NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import type { EventDetails } from "@/lib/types";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null as unknown as Resend;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { eventId, emailType, eventName } = await request.json();
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
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
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

  if (!userEmail) {
    return NextResponse.json(
      { error: "User email not found" },
      { status: 404 }
    );
  }

  const emailToSend = await getUserEmail({ userId, eventId, emailType, eventName, supabase });

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
  eventName,
  supabase,
}: {
  userId: string;
  eventId: string;
  emailType: EMAIL_TYPES;
  eventName?: string;
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>;
}) => {
  // For templates that need event details, fetch them
  let eventData: EventDetails | null = null;
  if (emailType !== EMAIL_TYPES.CHECKIN_QR_CODE) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("event_id", eventId)
      .single();
    if (!error && data) {
      eventData = data as EventDetails;
    }
  }

  const resolvedEventName = eventName || eventData?.event_name || "Event";

  switch (emailType) {
    case EMAIL_TYPES.CHECKIN_QR_CODE:
      return await getCheckinQRCodeEmail(resolvedEventName, userId, eventId);
    case EMAIL_TYPES.EVENT_UPDATE:
      return getEventUpdateNotificationEmail(
        resolvedEventName,
        eventId,
        (eventData as EventDetails) || ({} as EventDetails)
      );
    case EMAIL_TYPES.EVENT_SCHEDULE_UPDATE:
      return getEventScheduleUpdateNotificationEmail(
        resolvedEventName,
        eventId,
        (eventData as EventDetails) || ({} as EventDetails)
      );
    default:
      // Fallback to a simple check-in email if unknown type
      return await getCheckinQRCodeEmail(resolvedEventName, userId, eventId);
  }
};
