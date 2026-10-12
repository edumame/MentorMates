const ADMIN_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/admin`
    : "https://mentormates.ai/admin";

export interface EventApprovalRequestEmailData {
  eventName: string;
  organizerName: string;
  organizerEmail: string;
  eventDate: string;
  location: string;
  eventId: string;
}

export function getEventApprovalRequestEmailTemplate(
  data: EventApprovalRequestEmailData
) {
  const eventUrl = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/events/${data.eventId}/overview`
    : `https://mentormates.ai/events/${data.eventId}/overview`;

  return {
    subject: `[IMPORTANT] Action Required: Approve Event — "${data.eventName}"`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="font-size: 14px; color: #92400e; margin: 0; font-weight: bold;">
            ⚠️ This event requires your approval before it can go live.
          </p>
        </div>

        <h1 style="color: #2563eb; margin-bottom: 8px;">New Event Submitted for Approval</h1>

        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">Event Name</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${data.eventName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Submitted By</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px;">${data.organizerName} (${data.organizerEmail})</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Event Date</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px;">${data.eventDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Location</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px;">${data.location}</td>
          </tr>
        </table>

        <div style="margin: 24px 0;">
          <a href="${eventUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-right: 12px;">
            View Event
          </a>
          <a href="${ADMIN_DASHBOARD_URL}" style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Go to Admin Dashboard
          </a>
        </div>

        <p style="font-size: 14px; line-height: 1.5; color: #6b7280; margin-top: 24px;">
          Please review and approve or reject this event at your earliest convenience.
        </p>

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 14px; color: #6b7280; margin: 0;">
            — MentorMates Platform
          </p>
        </div>
      </div>
    `,
  };
}
