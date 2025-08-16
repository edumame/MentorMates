import { EmailTemplateSettings, DEFAULT_EMAIL_TEMPLATE_SETTINGS } from '@/lib/email_templates/config';

/**
 * Server-side email configuration
 * This file provides a centralized way to configure email templates and settings
 */

export interface ServerEmailConfig {
  smtp: {
    service?: string;
    host?: string;
    port?: number;
    secure?: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  templates: EmailTemplateSettings;
  features: {
    enableConfigurableTemplates: boolean;
    enableTemplatePreview: boolean;
    enableBulkEmail: boolean;
  };
}

/**
 * Get server email configuration from environment variables
 */
export function getServerEmailConfig(): ServerEmailConfig {
  const templateSettings = getEmailTemplateSettingsFromEnv();
  
  return {
    smtp: {
      service: process.env.EMAIL_SERVICE || 'gmail',
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : undefined,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_APP_PASSWORD || '',
      },
    },
    templates: templateSettings,
    features: {
      enableConfigurableTemplates: process.env.ENABLE_CONFIGURABLE_TEMPLATES === 'true',
      enableTemplatePreview: process.env.ENABLE_TEMPLATE_PREVIEW === 'true',
      enableBulkEmail: process.env.ENABLE_BULK_EMAIL === 'true',
    },
  };
}

/**
 * Get email template settings with environment variable overrides
 */
function getEmailTemplateSettingsFromEnv(): EmailTemplateSettings {
  const settings = { ...DEFAULT_EMAIL_TEMPLATE_SETTINGS };
  
  // Override from configuration
  if (process.env.EMAIL_FROM_NAME) {
    settings.from.name = process.env.EMAIL_FROM_NAME;
  }
  
  if (process.env.EMAIL_FROM_ADDRESS) {
    settings.from.email = process.env.EMAIL_FROM_ADDRESS;
  }
  
  // Override branding
  if (process.env.COMPANY_NAME) {
    settings.branding.companyName = process.env.COMPANY_NAME;
  }
  
  if (process.env.COMPANY_LOGO_URL) {
    settings.branding.logoUrl = process.env.COMPANY_LOGO_URL;
  }
  
  if (process.env.COMPANY_WEBSITE_URL) {
    settings.branding.websiteUrl = process.env.COMPANY_WEBSITE_URL;
  }
  
  if (process.env.SUPPORT_EMAIL) {
    settings.branding.supportEmail = process.env.SUPPORT_EMAIL;
  }
  
  // Override styling
  if (process.env.EMAIL_PRIMARY_COLOR) {
    settings.styling.primaryColor = process.env.EMAIL_PRIMARY_COLOR;
  }
  
  if (process.env.EMAIL_BACKGROUND_COLOR) {
    settings.styling.backgroundColor = process.env.EMAIL_BACKGROUND_COLOR;
  }
  
  if (process.env.EMAIL_FONT_FAMILY) {
    settings.styling.fontFamily = process.env.EMAIL_FONT_FAMILY;
  }
  
  if (process.env.EMAIL_MAX_WIDTH) {
    settings.styling.maxWidth = process.env.EMAIL_MAX_WIDTH;
  }
  
  if (process.env.EMAIL_BORDER_RADIUS) {
    settings.styling.borderRadius = process.env.EMAIL_BORDER_RADIUS;
  }
  
  // Override button styling
  if (process.env.EMAIL_BUTTON_BACKGROUND_COLOR) {
    settings.styling.buttonStyle = {
      ...settings.styling.buttonStyle,
      backgroundColor: process.env.EMAIL_BUTTON_BACKGROUND_COLOR,
    };
  }
  
  if (process.env.EMAIL_BUTTON_COLOR) {
    settings.styling.buttonStyle = {
      ...settings.styling.buttonStyle,
      color: process.env.EMAIL_BUTTON_COLOR,
    };
  }
  
  if (process.env.EMAIL_BUTTON_PADDING) {
    settings.styling.buttonStyle = {
      ...settings.styling.buttonStyle,
      padding: process.env.EMAIL_BUTTON_PADDING,
    };
  }
  
  if (process.env.EMAIL_BUTTON_BORDER_RADIUS) {
    settings.styling.buttonStyle = {
      ...settings.styling.buttonStyle,
      borderRadius: process.env.EMAIL_BUTTON_BORDER_RADIUS,
    };
  }
  
  // Template-specific overrides
  Object.keys(settings.templates).forEach(templateKey => {
    const envPrefix = `EMAIL_TEMPLATE_${templateKey.toUpperCase()}`;
    
    // Check if template is enabled/disabled
    const enabledEnv = process.env[`${envPrefix}_ENABLED`];
    if (enabledEnv !== undefined) {
      settings.templates[templateKey].enabled = enabledEnv === 'true';
    }
    
    // Check for custom subject
    const subjectEnv = process.env[`${envPrefix}_SUBJECT`];
    if (subjectEnv) {
      settings.templates[templateKey].subject = subjectEnv;
    }
    
    // Check for custom template
    const templateEnv = process.env[`${envPrefix}_TEMPLATE`];
    if (templateEnv) {
      settings.templates[templateKey].template = templateEnv;
    }
  });
  
  return settings;
}

/**
 * Validate email configuration
 */
export function validateEmailConfig(config: ServerEmailConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate SMTP configuration
  if (!config.smtp.auth.user) {
    errors.push('SMTP user is required');
  }
  
  if (!config.smtp.auth.pass) {
    errors.push('SMTP password is required');
  }
  
  // Validate template settings
  if (!config.templates.from.email) {
    errors.push('From email address is required');
  }
  
  if (!config.templates.branding.companyName) {
    errors.push('Company name is required');
  }
  
  if (!config.templates.branding.websiteUrl) {
    errors.push('Website URL is required');
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (config.templates.from.email && !emailRegex.test(config.templates.from.email)) {
    errors.push('Invalid from email address format');
  }
  
  if (config.templates.branding.supportEmail && !emailRegex.test(config.templates.branding.supportEmail)) {
    errors.push('Invalid support email address format');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get environment variables needed for email configuration
 */
export function getEmailConfigEnvVars(): Record<string, string | undefined> {
  return {
    // SMTP Configuration
    EMAIL_SERVICE: process.env.EMAIL_SERVICE,
    EMAIL_HOST: process.env.EMAIL_HOST,
    EMAIL_PORT: process.env.EMAIL_PORT,
    EMAIL_SECURE: process.env.EMAIL_SECURE,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_APP_PASSWORD: process.env.EMAIL_APP_PASSWORD,
    
    // From Configuration
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
    
    // Branding Configuration
    COMPANY_NAME: process.env.COMPANY_NAME,
    COMPANY_LOGO_URL: process.env.COMPANY_LOGO_URL,
    COMPANY_WEBSITE_URL: process.env.COMPANY_WEBSITE_URL,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
    
    // Styling Configuration
    EMAIL_PRIMARY_COLOR: process.env.EMAIL_PRIMARY_COLOR,
    EMAIL_BACKGROUND_COLOR: process.env.EMAIL_BACKGROUND_COLOR,
    EMAIL_FONT_FAMILY: process.env.EMAIL_FONT_FAMILY,
    EMAIL_MAX_WIDTH: process.env.EMAIL_MAX_WIDTH,
    EMAIL_BORDER_RADIUS: process.env.EMAIL_BORDER_RADIUS,
    
    // Button Styling
    EMAIL_BUTTON_BACKGROUND_COLOR: process.env.EMAIL_BUTTON_BACKGROUND_COLOR,
    EMAIL_BUTTON_COLOR: process.env.EMAIL_BUTTON_COLOR,
    EMAIL_BUTTON_PADDING: process.env.EMAIL_BUTTON_PADDING,
    EMAIL_BUTTON_BORDER_RADIUS: process.env.EMAIL_BUTTON_BORDER_RADIUS,
    
    // Feature Flags
    ENABLE_CONFIGURABLE_TEMPLATES: process.env.ENABLE_CONFIGURABLE_TEMPLATES,
    ENABLE_TEMPLATE_PREVIEW: process.env.ENABLE_TEMPLATE_PREVIEW,
    ENABLE_BULK_EMAIL: process.env.ENABLE_BULK_EMAIL,
  };
}