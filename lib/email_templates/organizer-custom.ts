interface OrganizerCustomEmailTemplate {
  subject: string;
  html: string;
}

export function getOrganizerCustomEmailTemplate(
  subject: string,
  message: string
): OrganizerCustomEmailTemplate {
  return {
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb; margin-bottom: 24px;">${subject}</h1>
        
        <div style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 24px; white-space: pre-wrap;">
          ${message.replace(/\n/g, '<br>')}
        </div>
        
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
            Best regards,
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
            The Event Organizers
          </p>
        </div>
      </div>
    `,
  };
}