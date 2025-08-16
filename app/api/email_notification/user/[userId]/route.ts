import { NextResponse, NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import {
  getCheckinQRCodeEmail,
} from "@/lib/email_templates/event-notifications";
import { EMAIL_TYPES, NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import { Resend } from "resend";
// Import new configurable template system
import { 
  getEmailTemplateService,
  getEmailRenderer 
} from "@/lib/email_templates";
import { getServerEmailConfig } from "@/lib/config/email";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { eventId, emailType, eventName, useConfigurableTemplates = false } = await request.json();
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

  const emailToSend = await getUserEmail(userId, eventId, eventName, emailType, useConfigurableTemplates);

  // Use configurable from address if available
  const emailRenderer = getEmailRenderer();
  const fromAddress = emailRenderer.getFromAddress() || NOTIFICATIONS_EMAIL_FROM;

  const { data, error } = await resend.emails.send({
    from: fromAddress,
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
    emailType: EMAIL_TYPES,
    useConfigurableTemplates: boolean = false
  ) => {
    // Check if configurable templates are enabled
    const serverConfig = getServerEmailConfig();
    const shouldUseConfigurable = useConfigurableTemplates && serverConfig.features.enableConfigurableTemplates;
    
    if (shouldUseConfigurable) {
      // Use new configurable template system
      const emailService = getEmailTemplateService();
      
      switch (emailType) {
        case EMAIL_TYPES.CHECKIN_QR_CODE:
          return emailService.generateCheckinQRCodeEmail(eventName, userId, eventId);
        default:
          return emailService.generateCheckinQRCodeEmail(eventName, userId, eventId);
      }
    } else {
      // Use legacy template system for backward compatibility
      switch (emailType) {
        case EMAIL_TYPES.CHECKIN_QR_CODE:
          return await getCheckinQRCodeEmail(eventName, userId, eventId);
        default:
          return await getCheckinQRCodeEmail(eventName, userId, eventId);
      }
    }
  };
