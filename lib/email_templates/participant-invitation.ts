export interface ParticipantInvitationEmailTemplate {
  subject: string;
  html: string;
}

export function getParticipantInvitationEmailTemplate(params: {
  eventName: string;
  eventId: string;
  eventSlug?: string | null;
  inviterName: string;
  participantName?: string;
}): ParticipantInvitationEmailTemplate {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const eventPath = params.eventSlug ? params.eventSlug : params.eventId;
  const acceptUrl = `${baseUrl}/events/${eventPath}/accept`;

  const greeting = params.participantName?.trim()
    ? `Hi ${params.participantName.trim()},`
    : "Hi there,";

  return {
    subject: `You're invited to "${params.eventName}" - MentorMates`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 32px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 26px; font-weight: bold;">
            You're invited to join an event
          </h1>
        </div>

        <div style="padding: 32px 20px;">
          <p style="font-size: 16px; line-height: 1.6; color: #111827; margin: 0 0 16px;">
            ${greeting}
          </p>

          <p style="font-size: 16px; line-height: 1.6; color: #374151; margin: 0 0 16px;">
            ${params.inviterName} invited you to join <strong>${params.eventName}</strong> on MentorMates.
          </p>

          <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5;">
              <strong>What to do next:</strong><br>
              1. Click the button below to accept the invitation<br>
              2. Sign in or create an account (if needed)<br>
              3. Choose your role and confirm your registration
            </p>
          </div>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${acceptUrl}"
               style="display: inline-block; background: #2563eb; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Accept Invitation
            </a>
          </div>

          <p style="font-size: 14px; line-height: 1.5; color: #6b7280; margin: 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${acceptUrl}" style="color: #2563eb; word-break: break-all;">${acceptUrl}</a>
          </p>

          <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 14px; color: #6b7280; margin: 0;">
              This invitation was sent by ${params.inviterName} through MentorMates.
            </p>
          </div>
        </div>
      </div>
    `,
  };
}


