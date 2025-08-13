import { NextResponse } from 'next/server';
import { isTwilioEnabled, twilioConfig } from '@/lib/config/twilio';
import { sendNotification } from '@/lib/utils/notifications';

// Test route to verify Twilio integration
export async function GET(request: Request) {
  try {
    // Check Twilio configuration
    const configStatus = {
      isEnabled: isTwilioEnabled(),
      hasAccountSid: !!twilioConfig.accountSid,
      hasAuthToken: !!twilioConfig.authToken,
      hasPhoneNumber: !!twilioConfig.phoneNumber,
      hasMessagingServiceSid: !!twilioConfig.messagingServiceSid,
    };

    return NextResponse.json({
      success: true,
      message: 'Twilio test endpoint',
      config: configStatus,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in Twilio test route:', error);
    return NextResponse.json(
      { 
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Test SMS sending
export async function POST(request: Request) {
  try {
    const { phoneNumber, testType = 'welcome', userName = 'Test User' } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required for testing' },
        { status: 400 }
      );
    }

    if (!isTwilioEnabled()) {
      return NextResponse.json(
        { error: 'Twilio is not properly configured' },
        { status: 503 }
      );
    }

    // Send test notification
    const result = await sendNotification(testType as any, {
      to: 'test@example.com', // Dummy email
      phone: phoneNumber,
      userName: userName,
      projectName: 'Test Project',
      mentorName: 'Test Mentor',
      eventName: 'Test Event',
      timeRemaining: '2 hours',
      inviterName: 'Test Inviter',
      feedback: 'This is a test feedback message',
      projectId: 'test-project-id',
      shortUrl: 'https://mentor-mates.com/test',
    });

    return NextResponse.json({
      success: true,
      message: 'Test SMS sent',
      result,
      testType,
      phoneNumber,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error sending test SMS:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send test SMS',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}