export interface ClaimTicketEmailTemplate {
  subject: string;
  html: string;
}

export function getClaimTicketEmailTemplate(
  eventName: string,
  ticketId: string,
  senderName: string
): ClaimTicketEmailTemplate {
  const claimUrl = `${process.env.NEXT_PUBLIC_APP_URL}/claim-ticket?ticket=${ticketId}`;
  
  return {
    subject: `You've been invited to ${eventName} - Claim Your Ticket`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
            🎫 You're Invited!
          </h1>
        </div>
        
        <div style="padding: 40px 20px;">
          <h2 style="color: #2563eb; margin-bottom: 20px; font-size: 24px;">
            ${senderName} has invited you to ${eventName}
          </h2>
          
          <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 20px;">
            Great news! You've been assigned a ticket to participate in <strong>${eventName}</strong>. 
            To secure your spot, you'll need to claim your ticket.
          </p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0;">
            <p style="margin: 0; color: #475569; font-size: 14px;">
              <strong>What happens next:</strong><br>
              1. Click the button below to claim your ticket<br>
              2. Sign in or create an account if you don't have one<br>
              3. Your ticket will be automatically assigned to your account
            </p>
          </div>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${claimUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
              🎫 Claim Your Ticket
            </a>
          </div>
          
          <p style="font-size: 14px; line-height: 1.5; color: #6b7280; margin-top: 30px;">
            If the button doesn't work, you can copy and paste this link into your browser:<br>
            <a href="${claimUrl}" style="color: #2563eb; word-break: break-all;">${claimUrl}</a>
          </p>
          
          <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
              Best regards,
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
              The MentorMates Team
            </p>
          </div>
        </div>
        
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #6b7280; margin: 0;">
            This invitation was sent by ${senderName} through MentorMates. 
            If you believe this was sent in error, please contact the event organizer.
          </p>
        </div>
      </div>
    `,
  };
}