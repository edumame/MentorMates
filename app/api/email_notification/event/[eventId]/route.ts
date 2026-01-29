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

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }
  const resend = new Resend(resendApiKey);

  const MAX_RECIPIENTS_PER_BATCH = 50;

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
