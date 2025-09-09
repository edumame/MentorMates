interface GuideFreeAccessEmailParams {
  email: string
  linkedinUrl: string
}

export function getGuideFreeAccessEmailTemplate({ email, linkedinUrl }: GuideFreeAccessEmailParams) {
  const subject = `LinkedIn share request: 2025 Ultimate AI Vibe Coding Guide`
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.6;">
      <h2>New Free Access Request</h2>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>LinkedIn Post:</strong> <a href="${linkedinUrl}">${linkedinUrl}</a></p>
      <p>Please verify the post tags <strong>@Chinat</strong> and approve access.</p>
    </div>
  `

  return { subject, html }
}

