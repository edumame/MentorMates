import { Resend } from "resend";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import { getWelcomeProfileEmailTemplate } from "@/lib/email_templates/welcome-profile";

// Called only after the server creates a profile from an authenticated session.
// Keep recipient selection out of a public email-sending endpoint.
export async function sendWelcomeProfileEmail(data: {
  to: string;
  displayName: string;
  profileUrl: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const template = getWelcomeProfileEmailTemplate(data.displayName, data.profileUrl);
  const { error } = await resend.emails.send({
    from: NOTIFICATIONS_EMAIL_FROM,
    to: data.to,
    ...template,
  });
  if (error) throw new Error("Welcome email delivery failed");
}
