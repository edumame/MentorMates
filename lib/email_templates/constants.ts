export const NOTIFICATIONS_EMAIL_FROM = "MentorMates <notifications@hello.mentormates.ai>"

export enum EMAIL_TYPES {
  EVENT_UPDATE = "event_update",
  EVENT_SCHEDULE_UPDATE = "event_schedule_update", 
  EVENT_CUSTOM_UPDATE = "event_custom_update",
  CHECKIN_QR_CODE = "checkin_qr_code",
  PROJECT_SUBMISSION = "project_submission",
  PROJECT_TEAMMATE = "project_teammate",
  FEEDBACK_NOTIFICATION = "feedback_notification",
  WELCOME = "welcome",
  PASSWORD_RESET = "password_reset",
}

// Template key mappings for backward compatibility
export const TEMPLATE_KEY_MAPPING = {
  [EMAIL_TYPES.EVENT_UPDATE]: "event_update",
  [EMAIL_TYPES.EVENT_SCHEDULE_UPDATE]: "event_schedule_update",
  [EMAIL_TYPES.EVENT_CUSTOM_UPDATE]: "event_custom_update",
  [EMAIL_TYPES.CHECKIN_QR_CODE]: "checkin_qr_code",
  [EMAIL_TYPES.PROJECT_SUBMISSION]: "project_submission",
  [EMAIL_TYPES.PROJECT_TEAMMATE]: "project_teammate",
  [EMAIL_TYPES.FEEDBACK_NOTIFICATION]: "feedback_notification",
  [EMAIL_TYPES.WELCOME]: "welcome",
  [EMAIL_TYPES.PASSWORD_RESET]: "password_reset",
} as const;

// Server configuration for email templates
export const EMAIL_CONFIG = {
  // Default sender configuration
  DEFAULT_FROM: NOTIFICATIONS_EMAIL_FROM,
  
  // Template validation
  REQUIRED_VARIABLES: {
    [EMAIL_TYPES.PROJECT_SUBMISSION]: ['projectName'],
    [EMAIL_TYPES.PROJECT_TEAMMATE]: ['projectName', 'leadName'],
    [EMAIL_TYPES.FEEDBACK_NOTIFICATION]: ['projectName', 'feedback'],
    [EMAIL_TYPES.EVENT_UPDATE]: ['eventName'],
    [EMAIL_TYPES.EVENT_SCHEDULE_UPDATE]: ['eventName', 'scheduleHtml'],
    [EMAIL_TYPES.EVENT_CUSTOM_UPDATE]: ['eventName', 'customTitle', 'customContent'],
    [EMAIL_TYPES.CHECKIN_QR_CODE]: ['eventName', 'ticketUrl'],
    [EMAIL_TYPES.WELCOME]: ['userName'],
    [EMAIL_TYPES.PASSWORD_RESET]: ['userName', 'resetUrl'],
  },
  
  // Environment variable mappings
  ENV_VARIABLES: {
    FROM_NAME: 'EMAIL_FROM_NAME',
    FROM_ADDRESS: 'EMAIL_FROM_ADDRESS', 
    COMPANY_NAME: 'COMPANY_NAME',
    COMPANY_LOGO_URL: 'COMPANY_LOGO_URL',
    COMPANY_WEBSITE_URL: 'COMPANY_WEBSITE_URL',
    SUPPORT_EMAIL: 'SUPPORT_EMAIL',
    PRIMARY_COLOR: 'EMAIL_PRIMARY_COLOR',
    BACKGROUND_COLOR: 'EMAIL_BACKGROUND_COLOR',
    FONT_FAMILY: 'EMAIL_FONT_FAMILY',
  },
} as const;
