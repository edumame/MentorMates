import { Resend } from "resend";
import {
  getEventApprovalRequestEmailTemplate,
  EventApprovalRequestEmailData,
} from "@/lib/email_templates/event-approval-request";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";

const APPROVAL_NOTIFICATION_RECIPIENTS = [
  "admin@mentormates.ai",
  "chinatchinat123@gmail.com",
  "jefferyjzhou@gmail.com",
];

export async function sendEventApprovalNotification(
  data: EventApprovalRequestEmailData
): Promise<{ sent: number; failed: number }> {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set — skipping approval notification emails");
    return { sent: 0, failed: APPROVAL_NOTIFICATION_RECIPIENTS.length };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { subject, html } = getEventApprovalRequestEmailTemplate(data);

  const results = await Promise.allSettled(
    APPROVAL_NOTIFICATION_RECIPIENTS.map((to) =>
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
