import { isTwilioEnabled } from '@/lib/config/twilio';

// Notification types
export type NotificationType = 
  | 'project_submission' 
  | 'feedback' 
  | 'team_invitation' 
  | 'event_reminder'
  | 'welcome';

// Notification data interface
interface BaseNotificationData {
  userId?: string;
  to: string; // email address
  phone?: string; // phone number
  projectName?: string;
  mentorName?: string;
  inviterName?: string;
  eventName?: string;
  timeRemaining?: string;
  userName?: string;
  shortUrl?: string;
  projectId?: string;
}

// Email notification data
interface EmailNotificationData extends BaseNotificationData {
  leadName?: string;
  teammates?: string[];
  feedback?: string;
}

// SMS notification data
interface SMSNotificationData extends BaseNotificationData {
  customMessage?: string;
}

// Notification result interface
interface NotificationResult {
  email?: {
    success: boolean;
    error?: string;
  };
  sms?: {
    success: boolean;
    error?: string;
    messageSid?: string;
  };
}

// Helper function to check if user has SMS enabled
async function getUserNotificationPreferences(userId: string) {
  try {
    const response = await fetch('/api/twilio/preferences', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('Failed to fetch user notification preferences');
      return {
        email_enabled: true,
        sms_enabled: false,
        project_submission_email: true,
        project_submission_sms: false,
        feedback_email: true,
        feedback_sms: false,
        event_reminders_email: true,
        event_reminders_sms: false,
        team_invitations_email: true,
        team_invitations_sms: false,
      };
    }

    const data = await response.json();
    return data.preferences || {};
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return {
      email_enabled: true,
      sms_enabled: false,
    };
  }
}

// Send email notification
async function sendEmailNotification(
  type: NotificationType,
  data: EmailNotificationData
): Promise<{ success: boolean; error?: string }> {
  try {
    const emailData: any = {
      type,
      to: data.to,
    };

    // Add type-specific data
    switch (type) {
      case 'project_submission':
        emailData.projectName = data.projectName;
        emailData.leadName = data.leadName;
        emailData.teammates = data.teammates || [];
        break;
      
      case 'feedback':
        emailData.projectName = data.projectName;
        emailData.mentorName = data.mentorName;
        emailData.feedback = data.feedback;
        emailData.projectId = data.projectId;
        break;
      
      default:
        // For other types, we might not have email templates yet
        console.warn(`Email template not implemented for type: ${type}`);
        return { success: false, error: 'Email template not implemented' };
    }

    const response = await fetch('/api/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || 'Failed to send email' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending email notification:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown email error' 
    };
  }
}

// Send SMS notification
async function sendSMSNotification(
  type: NotificationType,
  data: SMSNotificationData
): Promise<{ success: boolean; error?: string; messageSid?: string }> {
  try {
    if (!isTwilioEnabled()) {
      return { success: false, error: 'SMS service not configured' };
    }

    if (!data.phone) {
      return { success: false, error: 'No phone number provided' };
    }

    const smsData: any = {
      type,
      to: data.phone,
      userId: data.userId,
      shortUrl: data.shortUrl,
    };

    // Add type-specific data
    switch (type) {
      case 'project_submission':
        smsData.projectName = data.projectName;
        break;
      
      case 'feedback':
        smsData.projectName = data.projectName;
        smsData.mentorName = data.mentorName;
        break;
      
      case 'team_invitation':
        smsData.projectName = data.projectName;
        smsData.inviterName = data.inviterName;
        break;
      
      case 'event_reminder':
        smsData.eventName = data.eventName;
        smsData.timeRemaining = data.timeRemaining;
        break;
      
      case 'welcome':
        smsData.userName = data.userName;
        break;
      
      default:
        if (data.customMessage) {
          smsData.type = 'custom';
          smsData.customMessage = data.customMessage;
        } else {
          return { success: false, error: 'Invalid SMS type or missing custom message' };
        }
    }

    const response = await fetch('/api/twilio/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(smsData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || 'Failed to send SMS' };
    }

    const result = await response.json();
    return { 
      success: true, 
      messageSid: result.messageSid 
    };
  } catch (error) {
    console.error('Error sending SMS notification:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown SMS error' 
    };
  }
}

// Main notification function that handles both email and SMS
export async function sendNotification(
  type: NotificationType,
  data: BaseNotificationData & EmailNotificationData & SMSNotificationData
): Promise<NotificationResult> {
  const result: NotificationResult = {};
  
  // Get user preferences if userId is provided
  let preferences: any = {};
  if (data.userId) {
    preferences = await getUserNotificationPreferences(data.userId);
  }

  // Determine which notifications to send based on type and preferences
  const shouldSendEmail = preferences.email_enabled !== false && 
    (preferences[`${type}_email`] !== false);
  
  const shouldSendSMS = preferences.sms_enabled === true && 
    preferences[`${type}_sms`] === true && 
    data.phone;

  // Send email notification
  if (shouldSendEmail && data.to) {
    result.email = await sendEmailNotification(type, data);
  }

  // Send SMS notification
  if (shouldSendSMS && data.phone) {
    result.sms = await sendSMSNotification(type, data);
  }

  return result;
}

// Convenience functions for specific notification types

export async function sendProjectSubmissionNotification(data: {
  userId?: string;
  to: string;
  phone?: string;
  projectName: string;
  leadName: string;
  teammates?: string[];
  shortUrl?: string;
}): Promise<NotificationResult> {
  return sendNotification('project_submission', data);
}

export async function sendFeedbackNotification(data: {
  userId?: string;
  to: string;
  phone?: string;
  projectName: string;
  mentorName?: string;
  feedback: string;
  projectId: string;
  shortUrl?: string;
}): Promise<NotificationResult> {
  return sendNotification('feedback', data);
}

export async function sendTeamInvitationNotification(data: {
  userId?: string;
  to: string;
  phone?: string;
  projectName: string;
  inviterName: string;
  shortUrl?: string;
}): Promise<NotificationResult> {
  return sendNotification('team_invitation', data);
}

export async function sendEventReminderNotification(data: {
  userId?: string;
  to: string;
  phone?: string;
  eventName: string;
  timeRemaining: string;
  shortUrl?: string;
}): Promise<NotificationResult> {
  return sendNotification('event_reminder', data);
}

export async function sendWelcomeNotification(data: {
  userId?: string;
  to: string;
  phone?: string;
  userName: string;
  shortUrl?: string;
}): Promise<NotificationResult> {
  return sendNotification('welcome', data);
}

// Bulk notification functions for sending to multiple users
export async function sendBulkNotifications(
  type: NotificationType,
  recipients: Array<BaseNotificationData & EmailNotificationData & SMSNotificationData>
): Promise<NotificationResult[]> {
  const results = await Promise.allSettled(
    recipients.map(recipient => sendNotification(type, recipient))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Failed to send notification to ${recipients[index].to}:`, result.reason);
      return {
        email: { success: false, error: 'Bulk notification failed' },
        sms: { success: false, error: 'Bulk notification failed' }
      };
    }
  });
}

// Helper function to get short URLs for notifications
export function createShortUrl(baseUrl: string, path: string): string {
  // In production, you might want to use a URL shortening service
  // For now, just return the full URL
  return `${baseUrl}${path}`;
}

// Helper function to format time remaining
export function formatTimeRemaining(deadline: Date): string {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  
  if (diff <= 0) {
    return 'now';
  }
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}