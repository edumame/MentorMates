import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { Resend } from "resend";
import {
  NOTIFICATIONS_EMAIL_FROM,
  EMAIL_TYPES,
  ADMIN_EMAIL,
} from "@/lib/email_templates/constants";
import { ApprovalStatus, EventDetails, EventRole } from "@/lib/types";
import {
  getEventScheduleUpdateNotificationEmail,
  getEventUpdateNotificationEmail,
} from "@/lib/email_templates/event-notifications";
import { getOrganizerCustomEmailTemplate } from "@/lib/email_templates/organizer-custom";

import { EVENT_ROW_COLUMNS } from "@/lib/events/event-columns";
//allow custom messages
// Created per request so configuration is read at send time.
const getResend = () => new Resend(process.env.RESEND_API_KEY);

type UserEmail = {
  user_id: string;
  user_profiles: {
    email: string;
  };
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const supabase = await createSupabaseClient();
  const serviceSupabase = createSupabaseServiceClient();

  const { eventId } = await params;

  if (!eventId) {
    return NextResponse.json(
      { error: "Event ID is required" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { emailType, emailContent } = body;

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
    .maybeSingle();

  if (roleError) {
    return NextResponse.json({ error: "Error fetching role" }, { status: 500 });
  }

  // Signed in but not staff of this event (including no role at all) is a
  // permission failure, not a server error.
  if (
    roleData?.role !== EventRole.Organizer &&
    roleData?.role !== EventRole.Admin
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select(EVENT_ROW_COLUMNS)
    .eq("event_id", eventId)
    .single();

  if (eventError) {
    return NextResponse.json(
      { error: "Error fetching event" },
      { status: 500 }
    );
  }

  const eventDetails = eventData as EventDetails;

  // Event-wide email is only available once the platform approved the event:
  // anyone can create an event and become its organizer, so unreviewed events
  // must not be able to mass-mail from the platform sender.
  if (eventDetails.approval_status !== ApprovalStatus.Approved) {
    return NextResponse.json(
      { error: "Event-wide email is available after the event is approved." },
      { status: 403 }
    );
  }

  const eventName = eventDetails.event_name;

  const { data: participantsData, error: participantsError } = await serviceSupabase
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

  const MAX_RECIPIENTS_PER_BATCH = 50;
  const resend = getResend();

  // Check if we need to batch
  if (participantsEmails.length <= MAX_RECIPIENTS_PER_BATCH) {
    // Single email send
    const { data, error } = await resend.emails.send({
      from: NOTIFICATIONS_EMAIL_FROM,
      to: ADMIN_EMAIL,
      bcc: participantsEmails,
      subject: email.subject,
      html: email.html,
    });

    if (error) {
      return NextResponse.json({ error: "Error sending email" }, { status: 500 });
    }

    return NextResponse.json(
      { message: "Email sent successfully", data: data },
      { status: 200 }
    );
  }

  // Batch processing
  const batches: string[][] = [];
  for (let i = 0; i < participantsEmails.length; i += MAX_RECIPIENTS_PER_BATCH) {
    batches.push(participantsEmails.slice(i, i + MAX_RECIPIENTS_PER_BATCH));
  }

  const sendPromises = batches.map((batch) =>
    resend.emails.send({
      from: NOTIFICATIONS_EMAIL_FROM,
      to: ADMIN_EMAIL,
      bcc: batch,
      subject: email.subject,
      html: email.html,
    })
  );

  const results = await Promise.allSettled(sendPromises);

  // Check for any failures
  const failures = results.filter(
    (result) =>
      result.status === "rejected" ||
      (result.status === "fulfilled" &&
        result.value &&
        typeof result.value === "object" &&
        "error" in result.value &&
        result.value.error)
  );

  if (failures.length > 0) {
    console.error("Some email batches failed:", failures);
    return NextResponse.json(
      {
        error: "Some emails failed to send",
        failedBatches: failures.length,
        totalBatches: batches.length,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      message: `Email sent successfully in ${batches.length} batch(es)`,
      batches: batches.length,
    },
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
      // Organizer text is escaped (sent as plain text with line breaks), never
      // relayed as raw HTML.
      return getOrganizerCustomEmailTemplate(
        `Custom Message for "${eventName}" - MentorMates`,
        typeof emailContent === "string" ? emailContent : ""
      );
    default:
      return getEventUpdateNotificationEmail(
        eventName,
        eventId,
        eventInformation
      );
  }
};
