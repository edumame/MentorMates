import { NextResponse, NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import {
  getCheckinQRCodeEmail,
} from "@/lib/email_templates/event-notifications";
import { EMAIL_TYPES, NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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

  const { data: userEmail, error: emailError } = await supabase
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

  const emailToSend = await getUserEmail(userId, eventId, eventName, emailType);

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

const getUserEmail = async (
    userId: string,
    eventId: string,
    eventName: string,
    emailType: EMAIL_TYPES
  ) => {
    switch (emailType) {
      case EMAIL_TYPES.CHECKIN_QR_CODE:
        return await getCheckinQRCodeEmail(eventName, userId, eventId);
      default:
        return await getCheckinQRCodeEmail(eventName, userId, eventId);
    }
  };
