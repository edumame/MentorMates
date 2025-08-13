import { NextResponse } from 'next/server';
import { twilioClient, isTwilioEnabled, getTwilioFromParameter, formatPhoneNumber, validatePhoneNumber } from '@/lib/config/twilio';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { 
  getProjectSubmissionSMSTemplate,
  getFeedbackNotificationSMSTemplate,
  getTeamInvitationSMSTemplate,
  getEventReminderSMSTemplate,
  getWelcomeSMSTemplate
} from '@/lib/templates/sms-templates';

// SMS sending interface
interface SMSRequest {
  type: 'project_submission' | 'feedback' | 'team_invitation' | 'event_reminder' | 'welcome' | 'custom';
  to: string;
  userId?: string;
  projectName?: string;
  mentorName?: string;
  inviterName?: string;
  eventName?: string;
  timeRemaining?: string;
  userName?: string;
  customMessage?: string;
  shortUrl?: string;
}

// Helper function to log SMS to database
async function logSMSToDatabase(
  userId: string | null,
  phoneNumber: string,
  messageType: string,
  messageContent: string,
  twilioMessageSid?: string,
  status: string = 'pending',
  errorMessage?: string
) {
  try {
    const supabase = await createSupabaseClient();
    
    const { error } = await supabase
      .from('sms_logs')
      .insert({
        user_id: userId,
        phone_number: phoneNumber,
        message_type: messageType,
        message_content: messageContent,
        twilio_message_sid: twilioMessageSid,
        status,
        error_message: errorMessage,
      });

    if (error) {
      console.error('Failed to log SMS to database:', error);
    }
  } catch (error) {
    console.error('Error logging SMS to database:', error);
  }
}

// Helper function to check user SMS preferences
async function getUserSMSPreferences(userId: string) {
  try {
    const supabase = await createSupabaseClient();
    
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('sms_enabled')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no preferences found, default to opt-out for SMS
      return { sms_enabled: false };
    }

    return data;
  } catch (error) {
    console.error('Error checking SMS preferences:', error);
    return { sms_enabled: false };
  }
}

// Main SMS sending function
async function sendSMS(
  to: string,
  message: string,
  userId?: string,
  messageType: string = 'custom'
) {
  if (!isTwilioEnabled()) {
    throw new Error('Twilio is not configured');
  }

  if (!twilioClient) {
    throw new Error('Twilio client not initialized');
  }

  // Format and validate phone number
  const formattedPhone = formatPhoneNumber(to);
  if (!validatePhoneNumber(formattedPhone)) {
    throw new Error('Invalid phone number format');
  }

  try {
    const fromParameter = getTwilioFromParameter();
    
    const messageOptions = {
      ...fromParameter,
      to: formattedPhone,
      body: message,
    };

    const sentMessage = await twilioClient.messages.create(messageOptions);

    // Log successful SMS
    await logSMSToDatabase(
      userId || null,
      formattedPhone,
      messageType,
      message,
      sentMessage.sid,
      'sent'
    );

    return {
      success: true,
      messageSid: sentMessage.sid,
      status: sentMessage.status,
      to: formattedPhone,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log failed SMS
    await logSMSToDatabase(
      userId || null,
      formattedPhone,
      messageType,
      message,
      undefined,
      'failed',
      errorMessage
    );

    throw error;
  }
}

export async function POST(request: Request) {
  try {
    // Check if Twilio is enabled
    if (!isTwilioEnabled()) {
      return NextResponse.json(
        { error: 'SMS service is not configured' },
        { status: 503 }
      );
    }

    const body: SMSRequest = await request.json();
    const { type, to, userId, ...data } = body;

    if (!type || !to) {
      return NextResponse.json(
        { error: 'Missing required fields: type and to' },
        { status: 400 }
      );
    }

    // Check user SMS preferences if userId is provided
    if (userId) {
      const preferences = await getUserSMSPreferences(userId);
      if (!preferences.sms_enabled) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'User has not opted in to SMS notifications' 
          },
          { status: 200 }
        );
      }
    }

    let message: string;
    let messageType = type;

    // Generate message based on type
    switch (type) {
      case 'project_submission':
        if (!data.projectName) {
          return NextResponse.json(
            { error: 'Missing projectName for project_submission' },
            { status: 400 }
          );
        }
        const submissionTemplate = getProjectSubmissionSMSTemplate(
          data.projectName,
          data.shortUrl
        );
        message = submissionTemplate.message;
        break;

      case 'feedback':
        if (!data.projectName) {
          return NextResponse.json(
            { error: 'Missing projectName for feedback' },
            { status: 400 }
          );
        }
        const feedbackTemplate = getFeedbackNotificationSMSTemplate(
          data.projectName,
          data.mentorName || null,
          data.shortUrl
        );
        message = feedbackTemplate.message;
        break;

      case 'team_invitation':
        if (!data.projectName || !data.inviterName) {
          return NextResponse.json(
            { error: 'Missing projectName or inviterName for team_invitation' },
            { status: 400 }
          );
        }
        const invitationTemplate = getTeamInvitationSMSTemplate(
          data.projectName,
          data.inviterName,
          data.shortUrl
        );
        message = invitationTemplate.message;
        break;

      case 'event_reminder':
        if (!data.eventName || !data.timeRemaining) {
          return NextResponse.json(
            { error: 'Missing eventName or timeRemaining for event_reminder' },
            { status: 400 }
          );
        }
        const reminderTemplate = getEventReminderSMSTemplate(
          data.eventName,
          data.timeRemaining,
          data.shortUrl
        );
        message = reminderTemplate.message;
        break;

      case 'welcome':
        if (!data.userName) {
          return NextResponse.json(
            { error: 'Missing userName for welcome' },
            { status: 400 }
          );
        }
        const welcomeTemplate = getWelcomeSMSTemplate(data.userName);
        message = welcomeTemplate.message;
        break;

      case 'custom':
        if (!data.customMessage) {
          return NextResponse.json(
            { error: 'Missing customMessage for custom type' },
            { status: 400 }
          );
        }
        message = data.customMessage;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid SMS type' },
          { status: 400 }
        );
    }

    // Send the SMS
    const result = await sendSMS(to, message, userId, messageType);

    return NextResponse.json({
      success: true,
      messageSid: result.messageSid,
      status: result.status,
      to: result.to,
      message: message,
      characterCount: message.length,
    });

  } catch (error) {
    console.error('Error in SMS send route:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to send SMS';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}