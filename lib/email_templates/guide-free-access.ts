interface GuideFreeAccessEmailParams {
  email: string
  linkedinUrl: string
}

export function getGuideFreeAccessEmailTemplate({ email, linkedinUrl }: GuideFreeAccessEmailParams) {
  const subject = `LinkedIn share request: AI Vibe Guide free appendix access`
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.6;">
      <h2>New Free Access Request</h2>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>LinkedIn Post:</strong> <a href="${linkedinUrl}">${linkedinUrl}</a></p>
      <p>Please verify the post tags <strong>Chinat Yu</strong> and approve access (full guide including appendix).</p>
    </div>
  `

  return { subject, html }
}

