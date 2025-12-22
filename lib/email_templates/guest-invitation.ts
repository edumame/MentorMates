export interface GuestInvitationEmailTemplate {
  subject: string;
  html: string;
}

export function getGuestInvitationEmailTemplate(
  eventName: string,
  eventId: string,
  inviterName: string,
  eventSlug?: string,
  scheduleItem?: {
    dayTitle?: string;
    eventName?: string;
    time?: string;
  }
): GuestInvitationEmailTemplate {
  const eventUrl = eventSlug
    ? `https://mentormates.ai/events/${eventSlug}`
    : `https://mentormates.ai/events/${eventId}`;

  const scheduleInfo = scheduleItem
    ? `
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 8px;">Your Scheduled Session:</p>
          ${scheduleItem.dayTitle ? `<p style="font-size: 14px; color: #374151; margin: 4px 0;"><strong>Day:</strong> ${scheduleItem.dayTitle}</p>` : ''}
          ${scheduleItem.eventName ? `<p style="font-size: 14px; color: #374151; margin: 4px 0;"><strong>Session:</strong> ${scheduleItem.eventName}</p>` : ''}
          ${scheduleItem.time ? `<p style="font-size: 14px; color: #374151; margin: 4px 0;"><strong>Time:</strong> ${scheduleItem.time}</p>` : ''}
        </div>
      `
    : '';

  return {
    subject: `You've been invited as a guest for "${eventName}" - MentorMates`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb; margin-bottom: 24px;">Guest Invitation</h1>

        <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
          Hello!
        </p>

        <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
          You've been invited by ${inviterName} to be a guest at the event "${eventName}" on MentorMates.
        </p>

        ${scheduleInfo}

        <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 24px;">
          We're excited to have you join us! You can view the event details and learn more about what to expect.
        </p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px; font-weight: bold;">
            View Event Details
          </p>
          <p style="margin-bottom: 16px;">
            <a href="${eventUrl}"
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Event
            </a>
          </p>
          <p style="font-size: 14px; line-height: 1.4; color: #6b7280; margin: 0;">
            Or copy this link: <a href="${eventUrl}" style="color: #2563eb;">${eventUrl}</a>
          </p>
        </div>

        <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
          If you have any questions or need more information, please don't hesitate to reach out to the event organizers.
        </p>

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
            Best regards,
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
            The MentorMates Team
          </p>
        </div>
      </div>
    `,
  };
}

