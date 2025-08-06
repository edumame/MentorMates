import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { Resend } from "resend";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/config/constants";

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
    .select("event_name")
    .eq("id", eventId)
    .single();

  if (eventError) {
    return NextResponse.json(
      { error: "Error fetching event" },
      { status: 500 }
    );
  }

  const eventName = eventData.event_name;

  const { data: participants_data, error: participants_error } = await supabase
    .from("user_event_roles")
    .select("user_id, user_profiles(email)")
    .eq("event_id", eventId)
    .eq("role", "participant")
    .overrideTypes<UserEmail[]>();

  if (participants_error) {
    return NextResponse.json(
      { error: "Error fetching participants" },
      { status: 500 }
    );
  }

  const participants_emails = participants_data.map(
    (participant: UserEmail) => participant.user_profiles.email
  );

  const email = getEmailContent(eventId, email_content);

  await resend.emails.send({
    from: NOTIFICATIONS_EMAIL_FROM,
    to: NOTIFICATIONS_EMAIL_FROM,
    subject: `Notification for Event: ${eventName}`,
    bcc: participants_emails,
    html: email
  })

}


const getEmailContent = (eventId: string, email_content: string) => {
  switch (eventId) {
    case "":
      return email_content;
    case "2":
      return email_content;
    case "3":
      return email_content;
  }
  return email_content;
};
