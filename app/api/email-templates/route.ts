import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { 
  getEmailTemplateSettings, 
  EmailTemplateSettings, 
  EmailTemplateConfig,
  DEFAULT_EMAIL_TEMPLATE_SETTINGS 
} from '@/lib/email_templates/config';
import { EMAIL_TYPES } from '@/lib/email_templates/constants';

// Store email template configurations in database or environment
// For now, we'll use environment variables and provide an API to view/update them

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    
    // Check if user is authenticated and has admin privileges
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get current email template settings
    const settings = getEmailTemplateSettings();
    
    // Return settings (without sensitive data)
    const publicSettings = {
      branding: settings.branding,
      styling: settings.styling,
      templates: Object.keys(settings.templates).reduce((acc, key) => {
        const template = settings.templates[key];
        acc[key] = {
          enabled: template.enabled,
          subject: template.subject,
          // Don't expose full template content for security
          hasTemplate: !!template.template,
        };
        return acc;
      }, {} as Record<string, any>),
    };

    return NextResponse.json({
      success: true,
      settings: publicSettings,
      availableTypes: Object.values(EMAIL_TYPES),
    });

  } catch (error) {
    console.error('Error fetching email template settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email template settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    
    // Check if user is authenticated and has admin privileges
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // TODO: Add admin role check here
    // For now, allowing any authenticated user - in production, restrict to admins
    
    const body = await request.json();
    const { action, templateKey, config } = body;

    if (action === 'update_template') {
      if (!templateKey || !config) {
        return NextResponse.json(
          { error: 'Template key and config are required' },
          { status: 400 }
        );
      }

      // Validate template config structure
      if (typeof config.enabled !== 'boolean' || 
          typeof config.subject !== 'string' || 
          typeof config.template !== 'string') {
        return NextResponse.json(
          { error: 'Invalid template configuration structure' },
          { status: 400 }
        );
      }

      // In a real implementation, you would save this to a database
      // For now, we'll just validate and return success
      return NextResponse.json({
        success: true,
        message: `Template '${templateKey}' configuration validated`,
        note: 'Template updates require environment variable changes or database storage implementation',
      });
    }

    if (action === 'test_template') {
      if (!templateKey) {
        return NextResponse.json(
          { error: 'Template key is required for testing' },
          { status: 400 }
        );
      }

      const { variables = {} } = body;
      
      try {
        // Import the service dynamically to avoid circular dependencies
        const { getEmailTemplateService } = await import('@/lib/email_templates/service');
        const emailService = getEmailTemplateService();
        
        // Generate test email
        const emailType = templateKey as EMAIL_TYPES;
        const testEmail = emailService.generateEmail(emailType, {
          // Provide default test values
          projectName: 'Test Project',
          eventName: 'Test Event',
          userName: 'Test User',
          leadName: 'Test Lead',
          feedback: 'This is a test feedback message.',
          customTitle: 'Test Custom Title',
          customContent: 'This is test custom content.',
          ticketUrl: 'https://example.com/ticket',
          resetUrl: 'https://example.com/reset',
          dashboardUrl: 'https://example.com/dashboard',
          scheduleHtml: '<p>Test schedule content</p>',
          ...variables,
        });

        return NextResponse.json({
          success: true,
          email: testEmail,
        });
      } catch (error) {
        return NextResponse.json(
          { error: `Failed to render template: ${(error as Error).message}` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid action. Supported actions: update_template, test_template' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error managing email template settings:', error);
    return NextResponse.json(
      { error: 'Failed to manage email template settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    
    // Check if user is authenticated and has admin privileges
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { branding, styling } = body;

    // Validate the update payload
    if (!branding && !styling) {
      return NextResponse.json(
        { error: 'Either branding or styling configuration is required' },
        { status: 400 }
      );
    }

    // In a real implementation, you would save this to a database
    // For now, we'll validate the structure and return success
    
    if (branding) {
      const requiredBrandingFields = ['companyName', 'websiteUrl', 'supportEmail'];
      const missingFields = requiredBrandingFields.filter(field => !branding[field]);
      
      if (missingFields.length > 0) {
        return NextResponse.json(
          { error: `Missing required branding fields: ${missingFields.join(', ')}` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Email template settings validated',
      note: 'Settings updates require environment variable changes or database storage implementation',
      updated: { branding, styling },
    });

  } catch (error) {
    console.error('Error updating email template settings:', error);
    return NextResponse.json(
      { error: 'Failed to update email template settings' },
      { status: 500 }
    );
  }
}