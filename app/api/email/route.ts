import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getProjectSubmissionEmailTemplate } from '@/lib/email_templates/project-submission';
import { getProjectTeammateEmailTemplate } from '@/lib/email_templates/project-teammate';
import { getFeedbackNotificationEmailTemplate } from '@/lib/email_templates/feedback-notification';
import { createSupabaseClient } from '@/app/utils/supabase/server';
// Import new configurable template system
import { 
  getEmailTemplateService, 
  EMAIL_TYPES,
  getEmailRenderer 
} from '@/lib/email_templates';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

async function getTeammateEmails(emails: string[]) {
  const supabase = await createSupabaseClient();
  if (!emails.length) return [];
  
  const { data, error } = await supabase
    .from('user_profiles')
    .select('email')
    .in('email', emails);

  if (error) {
    return [];
  }

  return data.map(user => user.email);
}

async function sendEmail(to: string, subject: string, html: string, fromAddress?: string) {
  try {
    // Use configurable from address if available
    const emailRenderer = getEmailRenderer();
    const from = fromAddress || emailRenderer.getFromAddress() || process.env.EMAIL_USER;
    
    await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('Error sending email to', to, ':', error);
    return false;
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();

  try {
    const { type, useConfigurableTemplates = false, ...data } = await request.json();

    if (!type) {
      return NextResponse.json(
        { error: 'Missing email type' },
        { status: 400 }
      );
    }

    // Get email template service
    const emailService = getEmailTemplateService();

    if (type === 'project_submission') {
      const { to, projectName, leadName, teammates, projectUrl } = data;

      if (!to || !projectName || !leadName) {
        return NextResponse.json(
          { error: 'Missing required fields for project submission' },
          { status: 400 }
        );
      }

      // Use configurable templates if requested, otherwise use legacy templates
      let leadEmailTemplate;
      let teammateEmailTemplate;
      
      if (useConfigurableTemplates) {
        leadEmailTemplate = emailService.generateProjectSubmissionEmail(projectName, projectUrl);
        teammateEmailTemplate = emailService.generateProjectTeammateEmail(projectName, leadName, projectUrl);
      } else {
        // Legacy template system for backward compatibility
        leadEmailTemplate = getProjectSubmissionEmailTemplate(projectName);
        teammateEmailTemplate = getProjectTeammateEmailTemplate(projectName, leadName);
      }

      await sendEmail(to, leadEmailTemplate.subject, leadEmailTemplate.html);

      if (teammates && teammates.length > 0) {
        const teammateEmails = await getTeammateEmails(teammates);

        await Promise.all(
          teammateEmails.map(email =>
            sendEmail(email, teammateEmailTemplate.subject, teammateEmailTemplate.html)
          )
        );
      }
    } else if (type === 'feedback') {
      const { to, projectName, mentorName, feedback, projectId, projectUrl } = data;

      if (!to || !projectName || !feedback || !projectId) {
        return NextResponse.json(
          { error: 'Missing required fields for feedback notification' },
          { status: 400 }
        );
      }
      
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('teammates')
        .eq('id', projectId)
        .single();

      if (projectError) {
        return NextResponse.json(
          { error: 'Failed to fetch project teammates' },
          { status: 500 }
        );
      }

      const teammateEmails = projectData.teammates?.length
        ? await getTeammateEmails(projectData.teammates)
        : [];

      // Use configurable templates if requested, otherwise use legacy templates
      let feedbackEmailTemplate;
      
      if (useConfigurableTemplates) {
        feedbackEmailTemplate = emailService.generateFeedbackNotificationEmail(
          projectName,
          feedback,
          mentorName,
          projectUrl
        );
      } else {
        // Legacy template system for backward compatibility
        feedbackEmailTemplate = getFeedbackNotificationEmailTemplate(
          projectName,
          mentorName,
          feedback
        );
      }

      await sendEmail(to, feedbackEmailTemplate.subject, feedbackEmailTemplate.html);

      if (teammateEmails.length > 0) {
        await Promise.all(
          teammateEmails.map(email =>
            sendEmail(email, feedbackEmailTemplate.subject, feedbackEmailTemplate.html)
          )
        );
      }
    } else if (type === 'welcome') {
      const { to, userName, dashboardUrl } = data;

      if (!to || !userName) {
        return NextResponse.json(
          { error: 'Missing required fields for welcome email' },
          { status: 400 }
        );
      }

      const welcomeEmailTemplate = emailService.generateWelcomeEmail(userName, dashboardUrl);
      await sendEmail(to, welcomeEmailTemplate.subject, welcomeEmailTemplate.html);
      
    } else if (type === 'password_reset') {
      const { to, userName, resetUrl } = data;

      if (!to || !userName || !resetUrl) {
        return NextResponse.json(
          { error: 'Missing required fields for password reset email' },
          { status: 400 }
        );
      }

      const passwordResetEmailTemplate = emailService.generatePasswordResetEmail(userName, resetUrl);
      await sendEmail(to, passwordResetEmailTemplate.subject, passwordResetEmailTemplate.html);
      
    } else {
      return NextResponse.json(
        { error: 'Invalid email type' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in email API route:', error);
    return NextResponse.json(
      { error: 'Failed to send emails' },
      { status: 500 }
    );
  }
}