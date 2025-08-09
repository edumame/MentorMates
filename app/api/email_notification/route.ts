import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { Resend } from "resend";
import { NOTIFICATIONS_EMAIL_FROM, EMAIL_CONTENT_TYPES } from "@/lib/email_templates/constants";
import { EventDetails, EventRole } from "@/lib/types";
import {
  getEventScheduleUpdateNotificationEmail,
  getEventUpdateNotificationEmail,
} from "@/lib/email_templates/event-notifications";

const resend = new Resend(process.env.RESEND_API_KEY);

type UserEmail = {
  user_id: string;
  user_profiles: {
    email: string;
  };
};

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();

  const { eventId, emailContent } = await request.json();

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

  if (roleData.role !== EventRole.Organizer && roleData.role !== EventRole.Admin) {
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

  console.log(eventDetails);

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
    return NextResponse.json({ message: "No participants found. No email will be sent." }, { status: 200 });
  }

  const email = getEmailContent(
    eventName,
    eventId,
    eventDetails,
    emailContent
  );

  const { data, error } = await resend.emails.send({
    from: NOTIFICATIONS_EMAIL_FROM,
    to: NOTIFICATIONS_EMAIL_FROM,
    subject: email.subject,
    bcc: participantsEmails,
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

const getEmailContent = (
  eventName: string,
  eventId: string,
  eventInformation: EventDetails,
  emailContent: EMAIL_CONTENT_TYPES
) => {
  switch (emailContent) {
    case EMAIL_CONTENT_TYPES.EVENT_SCHEDULE_UPDATE:
      return getEventScheduleUpdateNotificationEmail(
        eventName,
        eventId,
        eventInformation
      );
    case EMAIL_CONTENT_TYPES.EVENT_UPDATE:
      return getEventUpdateNotificationEmail(eventName, eventId, eventInformation);
    default:
      return getEventUpdateNotificationEmail(eventName, eventId, eventInformation);
  }
};