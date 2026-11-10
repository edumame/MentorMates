import { escapeHtml, escapeUrl } from "./escape-html";

interface GuideFreeAccessEmailParams {
  email: string
  linkedinUrl: string
}

export function getGuideFreeAccessEmailTemplate({ email, linkedinUrl }: GuideFreeAccessEmailParams) {
  const subject = `LinkedIn share request: AI Vibe Guide free appendix access`
  const safeEmail = escapeHtml(email)
  const safeUrl = escapeUrl(linkedinUrl)
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.6;">
      <h2>New Free Access Request</h2>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>LinkedIn Post:</strong> <a href="${safeUrl}">${safeUrl}</a></p>
      <p>Please verify the post tags <strong>Chinat Yu</strong> and approve access (full guide including appendix).</p>
    </div>
  `

  return { subject, html }
}

