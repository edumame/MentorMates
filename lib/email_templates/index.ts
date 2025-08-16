// Main exports
export * from './config';
export * from './renderer';
export * from './service';
export * from './constants';

// Re-export for convenience
export { generateEventSchedule } from './event-notifications';

// Legacy exports for backward compatibility
export { 
  getProjectSubmissionEmailTemplate,
  getProjectTeammateEmailTemplate,
  getFeedbackNotificationEmailTemplate,
  getEventUpdateNotificationEmail,
  getEventScheduleUpdateNotificationEmail,
  getCheckinQRCodeEmail,
} from './service';

// Main service exports
export {
  EmailTemplateService,
  getEmailTemplateService,
} from './service';

// Configuration exports
export {
  EmailTemplateSettings,
  EmailTemplateConfig,
  EmailStyling,
  getEmailTemplateSettings,
  DEFAULT_EMAIL_TEMPLATE_SETTINGS,
  DEFAULT_EMAIL_STYLING,
} from './config';

// Renderer exports
export {
  EmailTemplateRenderer,
  getEmailRenderer,
  renderEmailTemplate,
  EmailTemplate,
  TemplateVariables,
} from './renderer';