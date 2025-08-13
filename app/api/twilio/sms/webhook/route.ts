import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { validateWebhook } from 'twilio';

// Twilio webhook validation
function validateTwilioWebhook(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!authToken) {
    console.warn('Twilio auth token not configured for webhook validation');
    return false;
  }

  try {
    return validateWebhook(authToken, signature, url, params);
  } catch (error) {
    console.error('Webhook validation error:', error);
    return false;
  }
}

// Update SMS log status in database
async function updateSMSStatus(
  messageSid: string,
  status: string,
  errorCode?: string,
  errorMessage?: string
) {
  try {
    const supabase = await createSupabaseClient();
    
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Set delivered_at timestamp for delivered messages
    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    // Add error information if present
    if (errorCode || errorMessage) {
      updateData.error_message = errorMessage || `Error code: ${errorCode}`;
    }

    const { error } = await supabase
      .from('sms_logs')
      .update(updateData)
      .eq('twilio_message_sid', messageSid);

    if (error) {
      console.error('Failed to update SMS status in database:', error);
    } else {
      console.log(`Updated SMS ${messageSid} status to ${status}`);
    }
  } catch (error) {
    console.error('Error updating SMS status:', error);
  }
}

// Log webhook event for debugging
async function logWebhookEvent(
  messageSid: string,
  status: string,
  eventData: Record<string, any>
) {
  try {
    const supabase = await createSupabaseClient();
    
    // You might want to create a webhook_logs table for debugging
    // For now, we'll just log to console in production
    console.log('SMS Webhook Event:', {
      messageSid,
      status,
      timestamp: new Date().toISOString(),
      eventData,
    });
  } catch (error) {
    console.error('Error logging webhook event:', error);
  }
}

export async function POST(request: Request) {
  try {
    // Get the raw body for webhook validation
    const body = await request.text();
    const params = new URLSearchParams(body);
    const webhookData = Object.fromEntries(params.entries());

    // Get Twilio signature header
    const signature = request.headers.get('x-twilio-signature') || '';
    const url = new URL(request.url).toString();

    // Validate webhook (in production, you should enable this)
    if (process.env.NODE_ENV === 'production') {
      const isValid = validateTwilioWebhook(url, webhookData, signature);
      
      if (!isValid) {
        console.warn('Invalid Twilio webhook signature');
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 403 }
        );
      }
    }

    // Extract webhook data
    const {
      MessageSid: messageSid,
      MessageStatus: messageStatus,
      ErrorCode: errorCode,
      ErrorMessage: errorMessage,
      To: to,
      From: from,
      Body: messageBody,
    } = webhookData;

    if (!messageSid || !messageStatus) {
      return NextResponse.json(
        { error: 'Missing required webhook parameters' },
        { status: 400 }
      );
    }

    // Log the webhook event
    await logWebhookEvent(messageSid, messageStatus, webhookData);

    // Update SMS status in database
    await updateSMSStatus(messageSid, messageStatus, errorCode, errorMessage);

    // Handle different status types
    switch (messageStatus) {
      case 'delivered':
        console.log(`SMS ${messageSid} delivered successfully to ${to}`);
        break;
        
      case 'failed':
      case 'undelivered':
        console.error(`SMS ${messageSid} failed to deliver to ${to}:`, errorMessage || errorCode);
        break;
        
      case 'sent':
        console.log(`SMS ${messageSid} sent to ${to}`);
        break;
        
      case 'queued':
        console.log(`SMS ${messageSid} queued for delivery to ${to}`);
        break;
        
      default:
        console.log(`SMS ${messageSid} status update: ${messageStatus}`);
    }

    // Return 200 to acknowledge receipt
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error processing SMS webhook:', error);
    
    // Return 200 even on error to prevent Twilio retries for non-recoverable errors
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 200 }
    );
  }
}

// Handle GET requests (for webhook URL verification)
export async function GET(request: Request) {
  return NextResponse.json({
    message: 'Twilio SMS webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}