/**
 * Example usage patterns for the email template system
 * These examples demonstrate how to use the configurable email templates
 */

import { 
  getEmailTemplateService,
  getEmailRenderer,
  renderEmailTemplate,
  EMAIL_TYPES 
} from './index';

// Example 1: Basic usage with the service
export function exampleBasicUsage() {
  const emailService = getEmailTemplateService();
  
  // Generate a project submission email
  const projectEmail = emailService.generateProjectSubmissionEmail(
    'My Awesome Hackathon Project',
    'https://mentormates.ai/projects/123'
  );
  
  console.log('Project Submission Email:');
  console.log('Subject:', projectEmail.subject);
  console.log('HTML length:', projectEmail.html.length);
  
  return projectEmail;
}

// Example 2: Custom branding and styling
export function exampleCustomBranding() {
  const customSettings = {
    branding: {
      companyName: 'TechCorp Hackathon',
      logoUrl: 'https://techcorp.com/logo.png',
      websiteUrl: 'https://hackathon.techcorp.com',
      supportEmail: 'support@techcorp.com',
    },
    styling: {
      primaryColor: '#ff6b6b',
      backgroundColor: '#f8f9fa',
      fontFamily: 'Helvetica, Arial, sans-serif',
      buttonStyle: {
        backgroundColor: '#ff6b6b',
        color: '#ffffff',
        borderRadius: '12px',
        padding: '16px 32px',
      },
    },
  };

  const emailService = getEmailTemplateService({ customSettings });
  
  const welcomeEmail = emailService.generateWelcomeEmail(
    'Jane Developer',
    'https://hackathon.techcorp.com/dashboard'
  );
  
  return welcomeEmail;
}

// Example 3: Event notification with schedule
export function exampleEventNotification() {
  const emailService = getEmailTemplateService();
  
  const mockEventDetails = {
    event_id: 'event-123',
    event_name: 'Summer Hackathon 2024',
    slug: 'summer-hackathon-2024',
    event_schedule: [
      {
        time: 'Friday, July 15',
        events: [
          { name: 'Registration & Networking', time: '2:00 PM - 3:00 PM' },
          { name: 'Opening Ceremony', time: '3:00 PM - 4:00 PM' },
          { name: 'Team Formation', time: '4:00 PM - 5:00 PM' },
        ],
      },
      {
        time: 'Saturday, July 16',
        events: [
          { name: 'Hacking Begins', time: '9:00 AM' },
          { name: 'Lunch Break', time: '12:00 PM - 1:00 PM' },
          { name: 'Mentor Speed Dating', time: '3:00 PM - 4:00 PM' },
        ],
      },
    ],
  } as any;
  
  const scheduleEmail = emailService.generateEventScheduleUpdateEmail(
    'Summer Hackathon 2024',
    'event-123',
    mockEventDetails
  );
  
  return scheduleEmail;
}

// Example 4: Custom event update
export function exampleCustomEventUpdate() {
  const emailService = getEmailTemplateService();
  
  const customEmail = emailService.generateEventCustomUpdateEmail(
    'Summer Hackathon 2024',
    'event-123',
    'Important: Venue Change',
    `
      <p>We have an important update regarding the venue for our upcoming hackathon.</p>
      <p><strong>New Venue:</strong> Tech Innovation Center<br>
      <strong>Address:</strong> 123 Innovation Drive, Tech City</p>
      <p>All other details remain the same. We apologize for any inconvenience and look forward to seeing you there!</p>
    `
  );
  
  return customEmail;
}

// Example 5: Feedback notification
export function exampleFeedbackNotification() {
  const emailService = getEmailTemplateService();
  
  const feedbackEmail = emailService.generateFeedbackNotificationEmail(
    'AI-Powered Weather App',
    'Great work on the user interface! Consider adding more data visualization features and improving the mobile responsiveness. The API integration is solid.',
    'Dr. Sarah Johnson',
    'https://mentormates.ai/projects/456'
  );
  
  return feedbackEmail;
}

// Example 6: Direct template rendering
export function exampleDirectRendering() {
  const customVariables = {
    projectName: 'Blockchain Voting System',
    leadName: 'Alex Chen',
    companyName: 'BlockHack 2024',
    primaryColor: '#6366f1',
    fontFamily: 'Georgia, serif',
  };
  
  const email = renderEmailTemplate('project_teammate', customVariables);
  
  return email;
}

// Example 7: Testing template availability
export function exampleTemplateManagement() {
  const emailRenderer = getEmailRenderer();
  
  // Check available templates
  const availableTemplates = emailRenderer.getAvailableTemplates();
  console.log('Available templates:', availableTemplates);
  
  // Check if specific template is available
  const isWelcomeAvailable = emailRenderer.isTemplateAvailable('welcome');
  console.log('Welcome template available:', isWelcomeAvailable);
  
  // Get configured from address
  const fromAddress = emailRenderer.getFromAddress();
  console.log('From address:', fromAddress);
  
  return {
    availableTemplates,
    isWelcomeAvailable,
    fromAddress,
  };
}

// Example 8: Error handling
export function exampleErrorHandling() {
  const emailService = getEmailTemplateService();
  
  try {
    // This will throw an error due to missing required variables
    const email = emailService.generateProjectSubmissionEmail(''); // Empty project name
  } catch (error) {
    console.error('Template generation error:', error.message);
    return { error: error.message };
  }
  
  try {
    // This will throw an error for non-existent template
    const email = renderEmailTemplate('non_existent_template', {});
  } catch (error) {
    console.error('Template not found error:', error.message);
    return { error: error.message };
  }
}

// Example usage in API routes
export function exampleAPIIntegration() {
  return {
    // Example POST body for project submission
    projectSubmissionAPI: {
      type: 'project_submission',
      useConfigurableTemplates: true,
      to: 'user@example.com',
      projectName: 'My Project',
      leadName: 'John Doe',
      projectUrl: 'https://example.com/project/123',
    },
    
    // Example POST body for testing templates
    templateTestAPI: {
      action: 'test_template',
      templateKey: 'welcome',
      variables: {
        userName: 'Test User',
        dashboardUrl: 'https://example.com/dashboard',
      },
    },
    
    // Example response from GET /api/email-templates
    templateConfigAPI: {
      success: true,
      settings: {
        branding: {
          companyName: 'MentorMates',
          websiteUrl: 'https://mentormates.ai',
          supportEmail: 'support@mentormates.ai',
        },
        styling: {
          primaryColor: '#2563eb',
          backgroundColor: '#ffffff',
          fontFamily: 'Arial, sans-serif',
        },
        templates: {
          project_submission: {
            enabled: true,
            subject: 'Project "{{projectName}}" Submitted - {{companyName}}',
            hasTemplate: true,
          },
          // ... other templates
        },
      },
      availableTypes: Object.values(EMAIL_TYPES),
    },
  };
}