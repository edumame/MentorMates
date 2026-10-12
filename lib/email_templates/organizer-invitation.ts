export interface OrganizerInvitationEmailTemplate {
  subject: string;
  html: string;
}

export function getOrganizerInvitationEmailTemplate(
  eventName: string,
  eventId: string,
  inviterName: string,
  eventSlug?: string,
  isNewUser?: boolean,
  acceptUrl?: string,
  eventUrlOverride?: string
): OrganizerInvitationEmailTemplate {
  const eventUrl =
    eventUrlOverride ||
    `${process.env.NEXT_PUBLIC_APP_URL}/events/${eventSlug || eventId}/overview`;

  const actionUrl = isNewUser && acceptUrl ? acceptUrl : eventUrl;
  const actionText = isNewUser
    ? "Accept Invitation & Sign Up"
    : "Access Event Dashboard";
  const instructionText = isNewUser
    ? "Click the button below to accept your invitation. You'll be prompted to create an account or sign in, and you'll automatically receive organizer access for this event."
    : "Your organizer permissions have already been activated. Simply log in to your MentorMates account to access the event dashboard.";

  return {
    subject: `You've been invited to organize "${eventName}" - MentorMates`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb; margin-bottom: 24px;">Organizer Invitation</h1>

        <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
          Great news! You've been invited by ${inviterName} to be an organizer for the event "${eventName}" on MentorMates.
        </p>

        <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 24px;">
          As an organizer, you'll have access to:
        </p>

        <ul style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 24px; padding-left: 20px;">
          <li>Event management dashboard</li>
          <li>Participant and project management</li>
          <li>Communication tools to send updates</li>
          <li>Analytics and reporting features</li>
        </ul>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px; font-weight: bold;">
            Ready to get started?
          </p>
          <p style="margin-bottom: 16px;">
            <a href="${actionUrl}"
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              ${actionText}
            </a>
          </p>
          <p style="font-size: 14px; line-height: 1.4; color: #6b7280; margin: 0;">
            Or copy this link: <a href="${actionUrl}" style="color: #2563eb;">${actionUrl}</a>
          </p>
        </div>

        <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
          ${instructionText}
        </p>

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
            Best regards,
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
            The MentorMates Team
          </p>
        </div>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
          <p>If you have any questions about your organizer role or need help getting started, please don't hesitate to reach out to our support team.</p>
        </div>
      </div>
    `,
  };
}
