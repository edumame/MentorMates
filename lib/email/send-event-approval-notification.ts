import nodemailer from "nodemailer";
import {
  getEventApprovalRequestEmailTemplate,
  EventApprovalRequestEmailData,
} from "@/lib/email_templates/event-approval-request";

const APPROVAL_NOTIFICATION_RECIPIENTS = [
  "admin@mentormates.ai",
  "chinatchinat123@gmail.com",
  "jefferyjzhou@gmail.com",
];

export async function sendEventApprovalNotification(
  data: EventApprovalRequestEmailData
): Promise<{ sent: number; failed: number }> {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });

  const { subject, html } = getEventApprovalRequestEmailTemplate(data);

  const results = await Promise.allSettled(
    APPROVAL_NOTIFICATION_RECIPIENTS.map((to) =>
      transporter.sendMail({
        from: process.env.EMAIL_USER,
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
