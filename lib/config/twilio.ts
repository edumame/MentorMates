import { Twilio } from 'twilio';

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

// Validate required environment variables
if (!accountSid || !authToken) {
  console.warn('Twilio credentials not configured. SMS features will be disabled.');
}

// Initialize Twilio client
export const twilioClient = accountSid && authToken 
  ? new Twilio(accountSid, authToken)
  : null;

// Twilio configuration object
export const twilioConfig = {
  accountSid,
  authToken,
  phoneNumber: twilioPhoneNumber,
  messagingServiceSid,
  isConfigured: !!(accountSid && authToken && twilioPhoneNumber),
};

// Helper function to check if Twilio is properly configured
export const isTwilioEnabled = (): boolean => {
  return twilioConfig.isConfigured;
};

// Helper function to get the 'from' parameter for messages
export const getTwilioFromParameter = () => {
  if (messagingServiceSid) {
    return { messagingServiceSid };
  } else if (twilioPhoneNumber) {
    return { from: twilioPhoneNumber };
  } else {
    throw new Error('No Twilio phone number or messaging service configured');
  }
};

// Validate phone number format (basic validation)
export const validatePhoneNumber = (phoneNumber: string): boolean => {
  // Basic E.164 format validation
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
};

// Format phone number to E.164 format
export const formatPhoneNumber = (phoneNumber: string): string => {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // If it starts with 1 and has 11 digits (US number), add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If it has 10 digits (US number without country code), add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it already starts with +, return as is
  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }
  
  // Otherwise, assume it needs + prefix
  return `+${digits}`;
};

export default twilioClient;