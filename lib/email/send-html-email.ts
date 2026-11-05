import { Resend } from "resend";
import { NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";

interface HtmlEmail {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/** Sends one email from server code. Returns false instead of throwing. */
export async function sendHtmlEmail({
  to,
  subject,
  html,
  from = NOTIFICATIONS_EMAIL_FROM,
}: HtmlEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject,
      html,
    });
    if (error) console.error("Failed to send email:", error);
    return !error;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}
