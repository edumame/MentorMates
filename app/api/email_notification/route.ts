import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { Resend } from "resend";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/config/constants";
import { EventDetails, EventRole } from "@/lib/types";
import {
  getEventScheduleUpdateNotificationEmail,
  getEventUpdateNotificationEmail,
} from "@/lib/templates/event-notifications";

const resend = new Resend(process.env.RESEND_API_KEY);

type UserEmail = {
  user_id: string;
  user_profiles: {
    email: string;
  };
};

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();

  const { eventId, email_content } = await request.json();

  //extract auth check to another function
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: role_data, error: role_error } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (role_error) {
    return NextResponse.json({ error: "Error fetching role" }, { status: 500 });
  }

  if (role_data.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("event_id", eventId)
    .limit(1)
    .single();

  if (eventError) {
    return NextResponse.json(
      { error: "Error fetching event" },
      { status: 500 }
    );
  }

  const eventDetails = eventData as EventDetails;

  const eventName = eventDetails.event_name;

  const { data: participants_data, error: participants_error } = await supabase
    .from("user_event_roles")
    .select("user_id, user_profiles(email)")
    .eq("event_id", eventId)
    .in("role", [EventRole.Mentor, EventRole.Participant, EventRole.Judge])
    .overrideTypes<Array<UserEmail>>();

  if (participants_error) {
    return NextResponse.json(
      { error: "Error fetching participants" },
      { status: 500 }
    );
  }

  const participants_emails = participants_data.map(
    (participant: UserEmail) => participant.user_profiles.email
  );

  const email = getEmailContent(
    eventName,
    eventId,
    eventDetails,
    email_content
  );

  const { data, error } = await resend.emails.send({
    from: NOTIFICATIONS_EMAIL_FROM,
    to: NOTIFICATIONS_EMAIL_FROM,
    subject: email.subject,
    bcc: participants_emails,
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
  event_information: EventDetails,
  email_content: string
) => {
  switch (email_content) {
    case "schedule_update":
      return getEventScheduleUpdateNotificationEmail(
        eventName,
        eventId,
        event_information
      );
    case "event_update":
      return getEventUpdateNotificationEmail(eventName, eventId);
    default:
      return getEventUpdateNotificationEmail(eventName, eventId);
  }
};
