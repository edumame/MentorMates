import { renderEmailTemplate, TemplateVariables, EmailTemplate } from './renderer';
import { EMAIL_TYPES, EMAIL_CONFIG, TEMPLATE_KEY_MAPPING } from './constants';
import { EmailTemplateSettings } from './config';
import { generateEventSchedule } from './event-notifications';
import { EventDetails } from '../types';

export interface EmailServiceConfig {
  customSettings?: Partial<EmailTemplateSettings>;
  validateRequired?: boolean;
}

/**
 * Email template service that provides high-level methods for generating emails
 */
export class EmailTemplateService {
  private config: EmailServiceConfig;

  constructor(config: EmailServiceConfig = {}) {
    this.config = { validateRequired: true, ...config };
  }

  /**
   * Validate that required variables are present for a template
   */
  private validateRequiredVariables(emailType: EMAIL_TYPES, variables: TemplateVariables): void {
    if (!this.config.validateRequired) return;

    const required = EMAIL_CONFIG.REQUIRED_VARIABLES[emailType];
    if (!required) return;

    const missing = required.filter(key => 
      variables[key] === undefined || variables[key] === null || variables[key] === ''
    );

    if (missing.length > 0) {
      throw new Error(`Missing required variables for ${emailType}: ${missing.join(', ')}`);
    }
  }

  /**
   * Generate project submission email
   */
  public generateProjectSubmissionEmail(
    projectName: string,
    projectUrl?: string,
    additionalVariables?: TemplateVariables
  ): EmailTemplate {
    const variables = {
      projectName,
      projectUrl,
      ...additionalVariables,
    };

    this.validateRequiredVariables(EMAIL_TYPES.PROJECT_SUBMISSION, variables);
    
    return renderEmailTemplate(
      TEMPLATE_KEY_MAPPING[EMAIL_TYPES.PROJECT_SUBMISSION],
      variables,
      this.config.customSettings
    );
  }

  /**
   * Generate project teammate notification email
   */
  public generateProjectTeammateEmail(
    projectName: string,
    leadName: string,
    projectUrl?: string,
    additionalVariables?: TemplateVariables
  ): EmailTemplate {
    const variables = {
      projectName,
      leadName,
      projectUrl,
      ...additionalVariables,
    };

    this.validateRequiredVariables(EMAIL_TYPES.PROJECT_TEAMMATE, variables);
    
    return renderEmailTemplate(
      TEMPLATE_KEY_MAPPING[EMAIL_TYPES.PROJECT_TEAMMATE],
      variables,
      this.config.customSettings
    );
  }

  /**
   * Generate feedback notification email
   */
  public generateFeedbackNotificationEmail(
    projectName: string,
    feedback: string,
    mentorName?: string,
    projectUrl?: string,
    additionalVariables?: TemplateVariables
  ): EmailTemplate {
    const variables = {
      projectName,
      feedback: feedback.replace(/\n/g, '<br>'),
      mentorName,
      projectUrl,
      ...additionalVariables,
    };

    this.validateRequiredVariables(EMAIL_TYPES.FEEDBACK_NOTIFICATION, variables);
    
    return renderEmailTemplate(
      TEMPLATE_KEY_MAPPING[EMAIL_TYPES.FEEDBACK_NOTIFICATION],
      variables,
      this.config.customSettings
    );
  }

  /**
   * Generate event update notification email
   */
  public generateEventUpdateEmail(
    eventName: string,
    eventId: string,
    eventInformation: EventDetails,
    additionalVariables?: TemplateVariables
  ): EmailTemplate {
    const eventUrl = `https://mentormates.ai/events/${eventInformation.slug || eventId}/overview`;
    
    const variables = {
      eventName,
      eventId,
      eventUrl,
      ...additionalVariables,
    };

    this.validateRequiredVariables(EMAIL_TYPES.EVENT_UPDATE, variables);
    
    return renderEmailTemplate(
      TEMPLATE_KEY_MAPPING[EMAIL_TYPES.EVENT_UPDATE],
      variables,
      this.config.customSettings
    );
  }

  /**
   * Generate event schedule update notification email
   */
  public generateEventScheduleUpdateEmail(
    eventName: string,
    eventId: string,
    eventInformation: EventDetails,
    additionalVariables?: TemplateVariables
  ): EmailTemplate {
    const eventUrl = `https://mentormates.ai/events/${eventInformation.slug || eventId}/overview`;
    const scheduleHtml = generateEventSchedule(eventInformation.event_schedule);
    
    const variables = {
      eventName,
      eventId,
      eventUrl,
      scheduleHtml,
      ...additionalVariables,
    };

    this.validateRequiredVariables(EMAIL_TYPES.EVENT_SCHEDULE_UPDATE, variables);
    
    return renderEmailTemplate(
      TEMPLATE_KEY_MAPPING[EMAIL_TYPES.EVENT_SCHEDULE_UPDATE],
      variables,
      this.config.customSettings
    );
  }

  /**
   * Generate custom event update email
   */
  public generateEventCustomUpdateEmail(
    eventName: string,
    eventId: string,
    customTitle: string,
    customContent: string,
    eventInformation?: EventDetails,
    additionalVariables?: TemplateVariables
  ): EmailTemplate {
    const eventUrl = eventInformation 
      ? `https://mentormates.ai/events/${eventInformation.slug || eventId}/overview`
      : undefined;
    
    const variables = {
      eventName,
      eventId,
      eventUrl,
      customTitle,
      customContent,
      ...additionalVariables,
    };

    this.validateRequiredVariables(EMAIL_TYPES.EVENT_CUSTOM_UPDATE, variables);
    
    return renderEmailTemplate(
      TEMPLATE_KEY_MAPPING[EMAIL_TYPES.EVENT_CUSTOM_UPDATE],
      variables,
      this.config.customSettings
    );
  }

  /**
   * Generate check-in QR code email
   */
  public generateCheckinQRCodeEmail(
    eventName: string,
    userId: string,
    eventId: string,
    additionalVariables?: TemplateVariables
  ): EmailTemplate {
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://mentormates.ai';
    const ticketUrl = `${origin}/ticket?evt=${eventId}&usr=${userId}`;
    
    const variables = {
      eventName,
      userId,
      eventId,
      ticketUrl,
      ...additionalVariables,
    };

    this.validateRequiredVariables(EMAIL_TYPES.CHECKIN_QR_CODE, variables);
    
    return renderEmailTemplate(
      TEMPLATE_KEY_MAPPING[EMAIL_TYPES.CHECKIN_QR_CODE],
      variables,
      this.config.customSettings
    );
  }

  /**
   * Generate welcome email for new users
   */
  public generateWelcomeEmail(
    userName: string,
    dashboardUrl?: string,
    additionalVariables?: TemplateVariables
  ): EmailTemplate {
    const defaultDashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://mentormates.ai'}/dashboard`;
    
    const variables = {
      userName,
      dashboardUrl: dashboardUrl || defaultDashboardUrl,
      ...additionalVariables,
    };

    this.validateRequiredVariables(EMAIL_TYPES.WELCOME, variables);
    
    return renderEmailTemplate(
      TEMPLATE_KEY_MAPPING[EMAIL_TYPES.WELCOME],
      variables,
      this.config.customSettings
    );
  }

  /**
   * Generate password reset email
   */
  public generatePasswordResetEmail(
    userName: string,
    resetUrl: string,
    additionalVariables?: TemplateVariables
  ): EmailTemplate {
    const variables = {
      userName,
      resetUrl,
      ...additionalVariables,
    };

    this.validateRequiredVariables(EMAIL_TYPES.PASSWORD_RESET, variables);
    
    return renderEmailTemplate(
      TEMPLATE_KEY_MAPPING[EMAIL_TYPES.PASSWORD_RESET],
      variables,
      this.config.customSettings
    );
  }

  /**
   * Generic method to generate any email template
   */
  public generateEmail(
    emailType: EMAIL_TYPES,
    variables: TemplateVariables
  ): EmailTemplate {
    this.validateRequiredVariables(emailType, variables);
    
    const templateKey = TEMPLATE_KEY_MAPPING[emailType];
    if (!templateKey) {
      throw new Error(`No template mapping found for email type: ${emailType}`);
    }
    
    return renderEmailTemplate(templateKey, variables, this.config.customSettings);
  }
}

// Singleton instance
let globalEmailService: EmailTemplateService | null = null;

/**
 * Get the global email template service instance
 */
export function getEmailTemplateService(config?: EmailServiceConfig): EmailTemplateService {
  if (!globalEmailService || config) {
    globalEmailService = new EmailTemplateService(config);
  }
  return globalEmailService;
}

/**
 * Quick helper functions for backward compatibility
 */
export function getProjectSubmissionEmailTemplate(projectName: string, projectUrl?: string): EmailTemplate {
  return getEmailTemplateService().generateProjectSubmissionEmail(projectName, projectUrl);
}

export function getProjectTeammateEmailTemplate(projectName: string, leadName: string, projectUrl?: string): EmailTemplate {
  return getEmailTemplateService().generateProjectTeammateEmail(projectName, leadName, projectUrl);
}

export function getFeedbackNotificationEmailTemplate(
  projectName: string,
  mentorName: string | null,
  feedback: string,
  projectUrl?: string
): EmailTemplate {
  return getEmailTemplateService().generateFeedbackNotificationEmail(
    projectName,
    feedback,
    mentorName || undefined,
    projectUrl
  );
}

export function getEventUpdateNotificationEmail(
  eventName: string,
  eventId: string,
  eventInformation: EventDetails
): EmailTemplate {
  return getEmailTemplateService().generateEventUpdateEmail(eventName, eventId, eventInformation);
}

export function getEventScheduleUpdateNotificationEmail(
  eventName: string,
  eventId: string,
  eventInformation: EventDetails
): EmailTemplate {
  return getEmailTemplateService().generateEventScheduleUpdateEmail(eventName, eventId, eventInformation);
}

export function getCheckinQRCodeEmail(
  eventName: string,
  userId: string,
  eventId: string
): EmailTemplate {
  return getEmailTemplateService().generateCheckinQRCodeEmail(eventName, userId, eventId);
}