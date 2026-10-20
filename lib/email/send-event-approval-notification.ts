import { Resend } from "resend";
import {
  getEventApprovalRequestEmailTemplate,
  EventApprovalRequestEmailData,
} from "@/lib/email_templates/event-approval-request";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";

export const DEFAULT_APPROVAL_NOTIFICATION_RECIPIENT = "admin@mentormates.ai";

/**
 * Reads recipients from the comma-separated APPROVAL_NOTIFICATION_RECIPIENTS
 * env var so personal addresses stay out of source. Falls back to the shared
 * admin inbox when the variable is unset or contains no addresses.
 */
export function getApprovalNotificationRecipients(): string[] {
  const configured = (process.env.APPROVAL_NOTIFICATION_RECIPIENTS ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

  return configured.length > 0
    ? Array.from(new Set(configured))
    : [DEFAULT_APPROVAL_NOTIFICATION_RECIPIENT];
}

export async function sendEventApprovalNotification(
  data: EventApprovalRequestEmailData
): Promise<{ sent: number; failed: number }> {
  const recipients = getApprovalNotificationRecipients();

  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set — skipping approval notification emails");
    return { sent: 0, failed: recipients.length };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { subject, html } = getEventApprovalRequestEmailTemplate(data);

  const results = await Promise.allSettled(
    recipients.map((to) =>
      resend.emails.send({
        from: NOTIFICATIONS_EMAIL_FROM,
        to,
        subject,
        html,
      })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  if (failed > 0) {
    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason);
    console.error("Failed to send some approval notification emails:", errors);
  }

  return { sent, failed };
}
