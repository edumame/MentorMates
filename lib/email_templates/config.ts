export interface EmailTemplateConfig {
  enabled: boolean;
  subject: string;
  template: string;
  variables?: Record<string, any>;
  styling?: EmailStyling;
}

export interface EmailStyling {
  primaryColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  maxWidth?: string;
  borderRadius?: string;
  buttonStyle?: {
    backgroundColor?: string;
    color?: string;
    padding?: string;
    borderRadius?: string;
  };
}

export interface EmailTemplateSettings {
  from: {
    name: string;
    email: string;
  };
  branding: {
    companyName: string;
    logoUrl?: string;
    websiteUrl: string;
    supportEmail: string;
  };
  styling: EmailStyling;
  templates: {
    [key: string]: EmailTemplateConfig;
  };
}

// Default email styling configuration
export const DEFAULT_EMAIL_STYLING: EmailStyling = {
  primaryColor: "#2563eb",
  backgroundColor: "#ffffff",
  fontFamily: "Arial, sans-serif",
  maxWidth: "600px",
  borderRadius: "8px",
  buttonStyle: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    padding: "12px 24px",
    borderRadius: "6px",
  },
};

// Default email template settings
export const DEFAULT_EMAIL_TEMPLATE_SETTINGS: EmailTemplateSettings = {
  from: {
    name: "MentorMates",
    email: "notifications@hello.mentormates.ai",
  },
  branding: {
    companyName: "MentorMates",
    websiteUrl: "https://mentormates.ai",
    supportEmail: "support@mentormates.ai",
  },
  styling: DEFAULT_EMAIL_STYLING,
  templates: {
    project_submission: {
      enabled: true,
      subject: 'Project "{{projectName}}" Submitted - {{companyName}}',
      template: `
        <div style="font-family: {{fontFamily}}; max-width: {{maxWidth}}; margin: 0 auto; background-color: {{backgroundColor}};">
          {{#if logoUrl}}
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="{{logoUrl}}" alt="{{companyName}}" style="max-width: 200px; height: auto;" />
          </div>
          {{/if}}
          
          <h1 style="color: {{primaryColor}}; margin-bottom: 24px;">Project Submission Confirmation</h1>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
            Thank you for submitting your project "{{projectName}}" to {{companyName}}!
          </p>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
            Your project has been successfully submitted and is now ready for mentor feedback.
            You will receive notifications when mentors provide feedback on your project.
          </p>
          
          {{#if projectUrl}}
          <div style="text-align: center; margin: 24px 0;">
            <a href="{{projectUrl}}" style="display: inline-block; background-color: {{buttonStyle.backgroundColor}}; color: {{buttonStyle.color}}; padding: {{buttonStyle.padding}}; text-decoration: none; border-radius: {{buttonStyle.borderRadius}}; font-weight: 500;">
              View Project
            </a>
          </div>
          {{/if}}
          
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
              Best regards,
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
              The {{companyName}} Team
            </p>
          </div>
        </div>
      `,
    },
    project_teammate: {
      enabled: true,
      subject: 'Added to Project "{{projectName}}" - {{companyName}}',
      template: `
        <div style="font-family: {{fontFamily}}; max-width: {{maxWidth}}; margin: 0 auto; background-color: {{backgroundColor}};">
          {{#if logoUrl}}
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="{{logoUrl}}" alt="{{companyName}}" style="max-width: 200px; height: auto;" />
          </div>
          {{/if}}
          
          <h1 style="color: {{primaryColor}}; margin-bottom: 24px;">Project Team Notification</h1>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
            You have been added as a team member to the project "{{projectName}}" by {{leadName}} in {{companyName}}.
          </p>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
            The project has been submitted and is now ready for mentor feedback.
            You will receive notifications when mentors provide feedback on your project.
          </p>
          
          {{#if projectUrl}}
          <div style="text-align: center; margin: 24px 0;">
            <a href="{{projectUrl}}" style="display: inline-block; background-color: {{buttonStyle.backgroundColor}}; color: {{buttonStyle.color}}; padding: {{buttonStyle.padding}}; text-decoration: none; border-radius: {{buttonStyle.borderRadius}}; font-weight: 500;">
              View Project
            </a>
          </div>
          {{/if}}
          
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
              Best regards,
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
              The {{companyName}} Team
            </p>
          </div>
        </div>
      `,
    },
    feedback_notification: {
      enabled: true,
      subject: 'New Feedback for Project "{{projectName}}" - {{companyName}}',
      template: `
        <div style="font-family: {{fontFamily}}; max-width: {{maxWidth}}; margin: 0 auto; background-color: {{backgroundColor}};">
          {{#if logoUrl}}
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="{{logoUrl}}" alt="{{companyName}}" style="max-width: 200px; height: auto;" />
          </div>
          {{/if}}
          
          <h1 style="color: {{primaryColor}}; margin-bottom: 24px;">New Project Feedback</h1>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
            You have received new feedback for your project "{{projectName}}"{{#if mentorName}} from mentor {{mentorName}}{{/if}}.
          </p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: {{borderRadius}}; margin-bottom: 24px;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px; font-weight: bold;">
              Feedback:
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; white-space: pre-wrap;">
              {{feedback}}
            </p>
          </div>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
            Please review this feedback and consider implementing the suggested improvements to enhance your project.
          </p>
          
          {{#if projectUrl}}
          <div style="text-align: center; margin: 24px 0;">
            <a href="{{projectUrl}}" style="display: inline-block; background-color: {{buttonStyle.backgroundColor}}; color: {{buttonStyle.color}}; padding: {{buttonStyle.padding}}; text-decoration: none; border-radius: {{buttonStyle.borderRadius}}; font-weight: 500;">
              View Project
            </a>
          </div>
          {{/if}}
          
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
              Best regards,
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
              The {{companyName}} Team
            </p>
          </div>
        </div>
      `,
    },
    event_update: {
      enabled: true,
      subject: 'New Event Update for "{{eventName}}" - {{companyName}}',
      template: `
        <div style="font-family: {{fontFamily}}; max-width: {{maxWidth}}; margin: 0 auto; background-color: {{backgroundColor}};">
          {{#if logoUrl}}
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="{{logoUrl}}" alt="{{companyName}}" style="max-width: 200px; height: auto;" />
          </div>
          {{/if}}
          
          <h1 style="color: {{primaryColor}}; margin-bottom: 24px;">New Event Update</h1>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
            The event "{{eventName}}" has been updated.
          </p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: {{borderRadius}}; margin-bottom: 24px;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px; font-weight: bold;">
              Please Check the Event Page for the Latest Update:
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151;">
              <a href="{{eventUrl}}" style="color: {{primaryColor}}; text-decoration: none;">{{eventName}}</a>
            </p>
          </div>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="{{eventUrl}}" style="display: inline-block; background-color: {{buttonStyle.backgroundColor}}; color: {{buttonStyle.color}}; padding: {{buttonStyle.padding}}; text-decoration: none; border-radius: {{buttonStyle.borderRadius}}; font-weight: 500;">
              View Event
            </a>
          </div>
          
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
              Best regards,
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
              The {{companyName}} Team
            </p>
          </div>
        </div>
      `,
    },
    event_schedule_update: {
      enabled: true,
      subject: 'New Event Schedule Update for "{{eventName}}" - {{companyName}}',
      template: `
        <div style="font-family: {{fontFamily}}; max-width: {{maxWidth}}; margin: 0 auto; background-color: {{backgroundColor}};">
          {{#if logoUrl}}
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="{{logoUrl}}" alt="{{companyName}}" style="max-width: 200px; height: auto;" />
          </div>
          {{/if}}
          
          <h1 style="color: {{primaryColor}}; margin-bottom: 24px;">New Event Schedule Update</h1>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
            The schedule for the event "{{eventName}}" has been updated.
          </p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: {{borderRadius}}; margin-bottom: 24px;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px; font-weight: bold;">
              Schedule change:
            </p>
            <div style="font-size: 16px; line-height: 1.5; color: #374151;">
              {{scheduleHtml}}
            </div>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px; font-weight: bold; margin-top: 16px;">
              Please Check the Event Page for the Latest Updates:
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151;">
              <a href="{{eventUrl}}" style="color: {{primaryColor}}; text-decoration: none;">{{eventName}}</a>
            </p>
          </div>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="{{eventUrl}}" style="display: inline-block; background-color: {{buttonStyle.backgroundColor}}; color: {{buttonStyle.color}}; padding: {{buttonStyle.padding}}; text-decoration: none; border-radius: {{buttonStyle.borderRadius}}; font-weight: 500;">
              View Event
            </a>
          </div>
          
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
              Best regards,
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
              The {{companyName}} Team
            </p>
          </div>
        </div>
      `,
    },
    event_custom_update: {
      enabled: true,
      subject: 'Update for "{{eventName}}" - {{companyName}}',
      template: `
        <div style="font-family: {{fontFamily}}; max-width: {{maxWidth}}; margin: 0 auto; background-color: {{backgroundColor}};">
          {{#if logoUrl}}
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="{{logoUrl}}" alt="{{companyName}}" style="max-width: 200px; height: auto;" />
          </div>
          {{/if}}
          
          <h1 style="color: {{primaryColor}}; margin-bottom: 24px;">{{customTitle}}</h1>
          
          <div style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 24px;">
            {{customContent}}
          </div>
          
          {{#if eventUrl}}
          <div style="text-align: center; margin: 24px 0;">
            <a href="{{eventUrl}}" style="display: inline-block; background-color: {{buttonStyle.backgroundColor}}; color: {{buttonStyle.color}}; padding: {{buttonStyle.padding}}; text-decoration: none; border-radius: {{buttonStyle.borderRadius}}; font-weight: 500;">
              View Event
            </a>
          </div>
          {{/if}}
          
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
              Best regards,
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
              The {{companyName}} Team
            </p>
          </div>
        </div>
      `,
    },
    checkin_qr_code: {
      enabled: true,
      subject: 'Check-In QR Code for "{{eventName}}" - {{companyName}}',
      template: `
        <div style="font-family: {{fontFamily}}; max-width: {{maxWidth}}; margin: 0 auto; background-color: {{backgroundColor}};">
          {{#if logoUrl}}
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="{{logoUrl}}" alt="{{companyName}}" style="max-width: 200px; height: auto;" />
          </div>
          {{/if}}
          
          <h1 style="color: {{primaryColor}}; margin-bottom: 24px;">Ticket for "{{eventName}}"</h1>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
            Get your ticket for the event "{{eventName}}".
          </p>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="{{ticketUrl}}" style="display: inline-block; background-color: {{buttonStyle.backgroundColor}}; color: {{buttonStyle.color}}; padding: {{buttonStyle.padding}}; text-decoration: none; border-radius: {{buttonStyle.borderRadius}}; font-weight: 500;">
              Get your ticket
            </a>
          </div>
          
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
              Best regards,
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
              The {{companyName}} Team
            </p>
          </div>
        </div>
      `,
    },
    welcome: {
      enabled: true,
      subject: 'Welcome to {{companyName}}!',
      template: `
        <div style="font-family: {{fontFamily}}; max-width: {{maxWidth}}; margin: 0 auto; background-color: {{backgroundColor}};">
          {{#if logoUrl}}
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="{{logoUrl}}" alt="{{companyName}}" style="max-width: 200px; height: auto;" />
          </div>
          {{/if}}
          
          <h1 style="color: {{primaryColor}}; margin-bottom: 24px;">Welcome to {{companyName}}!</h1>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
            Hi {{userName}},
          </p>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
            Welcome to {{companyName}}! We're excited to have you join our community of innovators, mentors, and learners.
          </p>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 24px;">
            Get started by exploring upcoming events and connecting with mentors in your area of interest.
          </p>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="{{dashboardUrl}}" style="display: inline-block; background-color: {{buttonStyle.backgroundColor}}; color: {{buttonStyle.color}}; padding: {{buttonStyle.padding}}; text-decoration: none; border-radius: {{buttonStyle.borderRadius}}; font-weight: 500;">
              Go to Dashboard
            </a>
          </div>
          
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
              Best regards,
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
              The {{companyName}} Team
            </p>
          </div>
        </div>
      `,
    },
    password_reset: {
      enabled: true,
      subject: 'Reset Your {{companyName}} Password',
      template: `
        <div style="font-family: {{fontFamily}}; max-width: {{maxWidth}}; margin: 0 auto; background-color: {{backgroundColor}};">
          {{#if logoUrl}}
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="{{logoUrl}}" alt="{{companyName}}" style="max-width: 200px; height: auto;" />
          </div>
          {{/if}}
          
          <h1 style="color: {{primaryColor}}; margin-bottom: 24px;">Reset Your Password</h1>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
            Hi {{userName}},
          </p>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
            You requested to reset your password for your {{companyName}} account. Click the button below to create a new password.
          </p>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="{{resetUrl}}" style="display: inline-block; background-color: {{buttonStyle.backgroundColor}}; color: {{buttonStyle.color}}; padding: {{buttonStyle.padding}}; text-decoration: none; border-radius: {{buttonStyle.borderRadius}}; font-weight: 500;">
              Reset Password
            </a>
          </div>
          
          <p style="font-size: 14px; line-height: 1.5; color: #6b7280; margin-bottom: 16px;">
            If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>
          
          <p style="font-size: 14px; line-height: 1.5; color: #6b7280; margin-bottom: 16px;">
            This link will expire in 24 hours for security reasons.
          </p>
          
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
              Best regards,
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
              The {{companyName}} Team
            </p>
          </div>
        </div>
      `,
    },
  },
};

// Environment-specific overrides
export function getEmailTemplateSettings(): EmailTemplateSettings {
  const settings = { ...DEFAULT_EMAIL_TEMPLATE_SETTINGS };
  
  // Override with environment variables if available
  if (process.env.EMAIL_FROM_NAME) {
    settings.from.name = process.env.EMAIL_FROM_NAME;
  }
  
  if (process.env.EMAIL_FROM_ADDRESS) {
    settings.from.email = process.env.EMAIL_FROM_ADDRESS;
  }
  
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
  
  // Override styling with environment variables
  if (process.env.EMAIL_PRIMARY_COLOR) {
    settings.styling.primaryColor = process.env.EMAIL_PRIMARY_COLOR;
  }
  
  if (process.env.EMAIL_BACKGROUND_COLOR) {
    settings.styling.backgroundColor = process.env.EMAIL_BACKGROUND_COLOR;
  }
  
  if (process.env.EMAIL_FONT_FAMILY) {
    settings.styling.fontFamily = process.env.EMAIL_FONT_FAMILY;
  }
  
  return settings;
}