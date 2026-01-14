import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { Resend } from "resend";
import {
  NOTIFICATIONS_EMAIL_FROM,
  EMAIL_TYPES,
  ADMIN_EMAIL,
} from "@/lib/email_templates/constants";
import { EventDetails, EventRole } from "@/lib/types";
import {
  getEventScheduleUpdateNotificationEmail,
  getEventUpdateNotificationEmail,
} from "@/lib/email_templates/event-notifications";

//allow custom messages
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null as unknown as Resend;

const BCC_MAX = 50;

type UserEmail = {
  user_id: string;
  user_profiles: {
    email: string;
  };
};

type ResendValidationError = {
  name: "validation_error";
  message: string;
  statusCode: 422;
};

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function isResendValidationError(error: unknown): error is ResendValidationError {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  return (
    e.name === "validation_error" &&
    typeof e.message === "string" &&
    e.statusCode === 422
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const supabase = await createSupabaseClient();

  const { eventId } = await params;

  if (!eventId) {
    return NextResponse.json(
      { error: "Event ID is required" },
      { status: 400 }
    );
  }

  const { emailType, emailContent } = await request.json();

  const customEmailContent = emailContent || "";

  //extract auth check to another function
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: roleData, error: roleError } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .single();

  if (roleError) {
    return NextResponse.json({ error: "Error fetching role" }, { status: 500 });
  }

  if (
    roleData.role !== EventRole.Organizer &&
    roleData.role !== EventRole.Admin
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("event_id", eventId)
    .single();

  if (eventError) {
    return NextResponse.json(
      { error: "Error fetching event" },
      { status: 500 }
    );
  }

  const eventDetails = eventData as EventDetails;

  const eventName = eventDetails.event_name;

  const { data: participantsData, error: participantsError } = await supabase
    .from("user_event_roles")
    .select("user_id, user_profiles(email)")
    .eq("event_id", eventId)
    .in("role", [EventRole.Mentor, EventRole.Participant, EventRole.Judge])
    .overrideTypes<Array<UserEmail>>();

  if (participantsError) {
    return NextResponse.json(
      { error: "Error fetching participants" },
      { status: 500 }
    );
  }

  const participantsEmails = participantsData.map(
    (participant: UserEmail) => participant.user_profiles.email
  );

  if (participantsEmails.length === 0) {
    return NextResponse.json(
      { message: "No participants found. No email will be sent." },
      { status: 200 }
    );
  }

  const email = getEventEmail(
    eventName,
    eventId,
    eventDetails,
    emailType,
    customEmailContent
  );

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  // Resend enforces a 50-recipient limit for `bcc`.
  // If the event has more than 50 recipients, send multiple emails in batches.
  const bccChunks = chunkArray(participantsEmails, BCC_MAX);
  let lastData: unknown = null;

  for (const bccChunk of bccChunks) {
    const { data, error } = await resend.emails.send({
      from: NOTIFICATIONS_EMAIL_FROM,
      to: ADMIN_EMAIL,
      bcc: bccChunk,
      subject: email.subject,
      html: email.html,
    });

    lastData = data ?? lastData;

    if (error) {
      console.error("Resend error sending event notification:", error);
      if (isResendValidationError(error)) {
        return NextResponse.json(error, { status: error.statusCode });
      }
      return NextResponse.json({ error: "Error sending email" }, { status: 500 });
    }
  }

  return NextResponse.json(
    { message: "Email sent successfully", batches: bccChunks.length, data: lastData },
    { status: 200 }
  );
}

const getEventEmail = (
  eventName: string,
  eventId: string,
  eventInformation: EventDetails,
  emailType: EMAIL_TYPES,
  emailContent: string
) => {
  switch (emailType) {
    case EMAIL_TYPES.EVENT_SCHEDULE_UPDATE:
      return getEventScheduleUpdateNotificationEmail(
        eventName,
        eventId,
        eventInformation
      );
    case EMAIL_TYPES.EVENT_UPDATE:
      return getEventUpdateNotificationEmail(
        eventName,
        eventId,
        eventInformation
      );
    case EMAIL_TYPES.EVENT_CUSTOM_UPDATE:
      return {
        subject: `Custom Message for "${eventName}" - MentorMates`,
        html: emailContent,
      };
    default:
      return getEventUpdateNotificationEmail(
        eventName,
        eventId,
        eventInformation
      );
  }
};
