// SMS Template interfaces
interface SMSTemplate {
  message: string;
  characterCount: number;
}

// Helper function to create SMS template with character count
const createSMSTemplate = (message: string): SMSTemplate => ({
  message,
  characterCount: message.length,
});

// Project Submission SMS Templates
export const getProjectSubmissionSMSTemplate = (
  projectName: string,
  shortUrl?: string
): SMSTemplate => {
  const baseMessage = `✅ Project "${projectName}" submitted successfully!`;
  const urlMessage = shortUrl ? ` View: ${shortUrl}` : ' Check your dashboard for details.';
  
  return createSMSTemplate(baseMessage + urlMessage);
};

// Feedback Notification SMS Templates
export const getFeedbackNotificationSMSTemplate = (
  projectName: string,
  mentorName: string | null,
  shortUrl?: string
): SMSTemplate => {
  const mentor = mentorName ? ` from ${mentorName}` : '';
  const baseMessage = `💬 New feedback on "${projectName}"${mentor}!`;
  const urlMessage = shortUrl ? ` View: ${shortUrl}` : ' Check your dashboard.';
  
  return createSMSTemplate(baseMessage + urlMessage);
};

// Team Invitation SMS Templates
export const getTeamInvitationSMSTemplate = (
  projectName: string,
  inviterName: string,
  shortUrl?: string
): SMSTemplate => {
  const baseMessage = `🤝 ${inviterName} added you to "${projectName}" team.`;
  const urlMessage = shortUrl ? ` Join: ${shortUrl}` : ' Check your dashboard to join.';
  
  return createSMSTemplate(baseMessage + urlMessage);
};

// Event Reminder SMS Templates
export const getEventReminderSMSTemplate = (
  eventName: string,
  timeRemaining: string,
  actionUrl?: string
): SMSTemplate => {
  const baseMessage = `⏰ ${eventName} deadline in ${timeRemaining}.`;
  const actionMessage = actionUrl ? ` Submit now: ${actionUrl}` : ' Submit your project soon!';
  
  return createSMSTemplate(baseMessage + actionMessage);
};

// General Event Update SMS Template
export const getEventUpdateSMSTemplate = (
  eventName: string,
  updateMessage: string,
  actionUrl?: string
): SMSTemplate => {
  const baseMessage = `📢 ${eventName}: ${updateMessage}`;
  const urlMessage = actionUrl ? ` More info: ${actionUrl}` : '';
  
  return createSMSTemplate(baseMessage + urlMessage);
};

// Welcome/Verification SMS Template
export const getWelcomeSMSTemplate = (userName: string): SMSTemplate => {
  const message = `👋 Welcome to MentorMate, ${userName}! You'll receive SMS updates for your hackathon projects. Reply STOP to opt out.`;
  
  return createSMSTemplate(message);
};

// Phone Verification SMS Template (for Twilio Verify API)
export const getPhoneVerificationSMSTemplate = (code: string): SMSTemplate => {
  const message = `Your MentorMate verification code is: ${code}. This code expires in 10 minutes.`;
  
  return createSMSTemplate(message);
};

// Unsubscribe confirmation SMS Template
export const getUnsubscribeSMSTemplate = (): SMSTemplate => {
  const message = `You've been unsubscribed from MentorMate SMS notifications. Reply START to re-enable.`;
  
  return createSMSTemplate(message);
};

// Error/Fallback SMS Template
export const getErrorSMSTemplate = (): SMSTemplate => {
  const message = `We couldn't process your request. Please check your MentorMate dashboard or contact support.`;
  
  return createSMSTemplate(message);
};

// Helper function to truncate message if it exceeds SMS limit
export const truncateSMSMessage = (message: string, maxLength: number = 160): string => {
  if (message.length <= maxLength) {
    return message;
  }
  
  return message.substring(0, maxLength - 3) + '...';
};

// Helper function to validate SMS template length
export const validateSMSLength = (template: SMSTemplate, maxLength: number = 160): boolean => {
  return template.characterCount <= maxLength;
};

// SMS template validation and warnings
export const getSMSTemplateWarnings = (template: SMSTemplate): string[] => {
  const warnings: string[] = [];
  
  if (template.characterCount > 160) {
    warnings.push(`Message exceeds 160 characters (${template.characterCount} chars). May be sent as multiple messages.`);
  }
  
  if (template.characterCount > 70) {
    warnings.push(`Message exceeds 70 characters. Consider shortening for single SMS.`);
  }
  
  return warnings;
};