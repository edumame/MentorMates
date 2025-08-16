import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { Resend } from "resend";
import {
  NOTIFICATIONS_EMAIL_FROM,
  EMAIL_TYPES,
} from "@/lib/email_templates/constants";
import { EventDetails, EventRole } from "@/lib/types";
import {
  getEventScheduleUpdateNotificationEmail,
  getEventUpdateNotificationEmail,
} from "@/lib/email_templates/event-notifications";
// Import new configurable template system
import { 
  getEmailTemplateService,
  getEmailRenderer 
} from "@/lib/email_templates";
import { getServerEmailConfig } from "@/lib/config/email";

//allow custom messages

const resend = new Resend(process.env.RESEND_API_KEY);

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

  const { emailType, emailContent, useConfigurableTemplates = false } = await request.json();

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
    customEmailContent,
    useConfigurableTemplates
  );

  // Use configurable from address if available
  const emailRenderer = getEmailRenderer();
  const fromAddress = emailRenderer.getFromAddress() || NOTIFICATIONS_EMAIL_FROM;

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to: participantsEmails,
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

const getEventEmail = (
  eventName: string,
  eventId: string,
  eventInformation: EventDetails,
  emailType: EMAIL_TYPES,
  emailContent: string,
  useConfigurableTemplates: boolean = false
) => {
  // Check if configurable templates are enabled
  const serverConfig = getServerEmailConfig();
  const shouldUseConfigurable = useConfigurableTemplates && serverConfig.features.enableConfigurableTemplates;
  
  if (shouldUseConfigurable) {
    // Use new configurable template system
    const emailService = getEmailTemplateService();
    
    switch (emailType) {
      case EMAIL_TYPES.EVENT_SCHEDULE_UPDATE:
        return emailService.generateEventScheduleUpdateEmail(
          eventName,
          eventId,
          eventInformation
        );
      case EMAIL_TYPES.EVENT_UPDATE:
        return emailService.generateEventUpdateEmail(
          eventName,
          eventId,
          eventInformation
        );
      case EMAIL_TYPES.EVENT_CUSTOM_UPDATE:
        return emailService.generateEventCustomUpdateEmail(
          eventName,
          eventId,
          "Custom Update", // Default title, could be made configurable
          emailContent,
          eventInformation
        );
      default:
        return emailService.generateEventUpdateEmail(
          eventName,
          eventId,
          eventInformation
        );
    }
  } else {
    // Use legacy template system for backward compatibility
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
  }
};
