function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

interface WelcomeProfileEmailTemplate {
  subject: string;
  html: string;
}

export function getWelcomeProfileEmailTemplate(
  displayName: string,
  profileUrl: string
): WelcomeProfileEmailTemplate {
  const safeName = escapeHtml(displayName?.trim() || "there");
  const safeProfileUrl = escapeHtml(profileUrl);

  return {
    subject: "Welcome to MentorMates — complete your profile",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb; margin-bottom: 16px;">Welcome to MentorMates, ${safeName}!</h1>

        <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 16px;">
          Your account has been created. Next, please take a minute to complete your profile so other people can find you and connect.
        </p>

        <div style="margin: 24px 0;">
          <a
            href="${safeProfileUrl}"
            style="
              display: inline-block;
              background-color: #2563eb;
              color: #ffffff;
              text-decoration: none;
              padding: 12px 18px;
              border-radius: 8px;
              font-size: 16px;
              font-weight: bold;
            "
          >
            Go to your profile
          </a>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #6b7280; margin-bottom: 16px;">
          If the button doesn’t work, copy and paste this link into your browser:
          <br />
          <a href="${safeProfileUrl}" style="color: #2563eb; text-decoration: underline;">${safeProfileUrl}</a>
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

