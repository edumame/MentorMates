export type EventInviteRole = "participant" | "judge";

export interface EventRoleInvitationEmailTemplate {
  subject: string;
  html: string;
}

const ROLE_COPY: Record<
  EventInviteRole,
  {
    label: string;
    heading: string;
    intro: string;
    body: string;
  }
> = {
  participant: {
    label: "participant",
    heading: "Participant Invitation",
    intro:
      "You've been invited to join this event as a participant on MentorMates.",
    body:
      "Review the event details, sign in, and join when you're ready to participate.",
  },
  judge: {
    label: "judge",
    heading: "Judge Invitation",
    intro:
      "You've been invited to support this event as a judge on MentorMates.",
    body:
      "Open the event page to review the details and sign in with the invited email address.",
  },
};

export function getEventRoleInvitationEmailTemplate({
  eventName,
  inviterName,
  role,
  actionUrl,
  eventUrl,
}: {
  eventName: string;
  inviterName: string;
  role: EventInviteRole;
  actionUrl: string;
  eventUrl: string;
}): EventRoleInvitationEmailTemplate {
  const copy = ROLE_COPY[role];

  return {
    subject: `You've been invited as a ${copy.label} for "${eventName}" - MentorMates`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb; margin-bottom: 24px;">${copy.heading}</h1>

        <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
          Hello!
        </p>

        <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
          ${inviterName} invited you to "${eventName}" on MentorMates.
        </p>

        <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
          ${copy.intro}
        </p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px; font-weight: bold;">
            Ready to get started?
          </p>
          <p style="margin-bottom: 16px;">
            <a href="${actionUrl}"
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Accept Invitation
            </a>
          </p>
          <p style="font-size: 14px; line-height: 1.4; color: #6b7280; margin: 0;">
            Sign in or create an account with the invited email address to accept your invitation.
          </p>
        </div>

        <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
          ${copy.body}
        </p>

        <p style="font-size: 14px; line-height: 1.5; color: #6b7280; margin-bottom: 16px;">
          Prefer to review the event first? <a href="${eventUrl}" style="color: #2563eb;">Open the event overview</a>.
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
