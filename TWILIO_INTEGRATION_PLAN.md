# Twilio Integration Plan for MentorMate

## Overview

This document outlines the integration of Twilio communication services into the MentorMate hackathon feedback platform. Twilio will enhance the existing email-based notification system with SMS and voice capabilities.

## Current State Analysis

### Existing Communication Infrastructure
- **Email System**: Nodemailer with Gmail SMTP for project submissions and feedback notifications
- **Templates**: Email templates for project submission, teammate invitations, and feedback notifications  
- **Notification Flow**: Currently disabled (commented out) in production due to stability concerns
- **User Data**: User profiles include email addresses in Supabase database

### Current Notification Types
1. **Project Submission Confirmations**: Sent to project leads and teammates
2. **Feedback Notifications**: Sent when mentors provide feedback on projects
3. **Event Updates**: Potential future use case

## Twilio Integration Strategy

### Phase 1: Core SMS Integration

#### 1.1 SMS Notification Types
- **Project Submission SMS**: Quick confirmation when project is submitted
- **Feedback Alert SMS**: Immediate notification when feedback is received
- **Event Reminder SMS**: Hackathon deadlines and important updates
- **Team Invitation SMS**: When added to a project team

#### 1.2 SMS Templates
```typescript
// SMS message examples (160 character limit consideration)
- Project Submission: "✅ Project '{projectName}' submitted successfully! View details: {shortUrl}"
- Feedback Alert: "💬 New feedback on '{projectName}' from {mentorName}. Check your dashboard!"
- Event Reminder: "⏰ {eventName} deadline in {timeLeft}. Submit your project now!"
- Team Invite: "🤝 You've been added to '{projectName}' team. Join now: {shortUrl}"
```

### Phase 2: Voice Integration

#### 2.1 Voice Call Features
- **Emergency Notifications**: Critical hackathon updates via voice calls
- **Accessibility Support**: Voice notifications for users who prefer audio
- **Bulk Announcements**: Event-wide voice messages to all participants

#### 2.2 Voice Message Types
- Pre-recorded messages for standard notifications
- Text-to-speech for dynamic content
- Interactive voice response (IVR) for feedback collection

### Phase 3: Advanced Features

#### 3.1 WhatsApp Integration
- Rich media notifications with project images
- Interactive buttons for quick actions
- Group messaging for project teams

#### 3.2 Two-Way SMS
- SMS responses for feedback acknowledgment
- Quick project status updates via SMS
- Automated responses with project links

## Technical Implementation

### Required Environment Variables

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number
TWILIO_MESSAGING_SERVICE_SID=your_messaging_service_sid (optional)

# WhatsApp (Phase 3)
TWILIO_WHATSAPP_NUMBER=whatsapp:+your_whatsapp_number

# Voice (Phase 2)  
TWILIO_TWIML_APP_SID=your_twiml_app_sid (for voice apps)
```

### Database Schema Updates

#### Add Phone Number Support
```sql
-- Add phone number to user profiles
ALTER TABLE user_profiles 
ADD COLUMN phone_number VARCHAR(20),
ADD COLUMN sms_notifications_enabled BOOLEAN DEFAULT false,
ADD COLUMN voice_notifications_enabled BOOLEAN DEFAULT false,
ADD COLUMN whatsapp_notifications_enabled BOOLEAN DEFAULT false;

-- Create notification preferences table
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  voice_enabled BOOLEAN DEFAULT false,
  whatsapp_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create SMS log table for tracking
CREATE TABLE sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  phone_number VARCHAR(20) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  message_content TEXT NOT NULL,
  twilio_message_sid VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);
```

### API Route Structure

#### New Twilio API Routes
```
app/api/twilio/
├── sms/
│   ├── send/route.ts           # Send SMS notifications
│   ├── webhook/route.ts        # Handle delivery status
│   └── bulk/route.ts           # Bulk SMS sending
├── voice/
│   ├── call/route.ts           # Initiate voice calls
│   ├── twiml/route.ts          # TwiML response handling
│   └── webhook/route.ts        # Call status webhooks
├── whatsapp/
│   ├── send/route.ts           # WhatsApp messages
│   └── webhook/route.ts        # WhatsApp webhooks
└── preferences/route.ts         # User notification preferences
```

### Integration Points

#### 1. Project Submission Flow
```typescript
// In features/projects/api/submit.ts
const sendNotifications = async (projectData, userPreferences) => {
  // Existing email notification (re-enable)
  await sendEmail(emailData);
  
  // New SMS notification
  if (userPreferences.sms_enabled) {
    await sendSMS({
      to: projectData.leadPhone,
      message: `✅ Project '${projectData.name}' submitted successfully!`
    });
  }
};
```

#### 2. Feedback Notification Flow
```typescript
// In features/projects/components/feedback/FeedbackForm.tsx
const notifyProjectTeam = async (feedbackData) => {
  const notifications = [];
  
  // Email notifications
  notifications.push(sendEmail(emailData));
  
  // SMS notifications for opted-in users
  const smsUsers = await getUsersWithSMSEnabled(projectData.teammates);
  smsUsers.forEach(user => {
    notifications.push(sendSMS({
      to: user.phone_number,
      message: `💬 New feedback on '${projectData.name}' from ${mentorName}`
    }));
  });
  
  await Promise.all(notifications);
};
```

### User Interface Updates

#### Phone Number Collection
- Add phone number field to user profile forms
- Phone number verification flow using Twilio Verify API
- Notification preferences dashboard

#### Admin Dashboard Enhancements
- SMS campaign management
- Delivery status monitoring  
- Bulk messaging interface
- Analytics for SMS engagement

## Security & Compliance

### Data Protection
- Phone numbers encrypted at rest
- Opt-in only for SMS notifications
- Easy unsubscribe mechanism
- GDPR/CCPA compliance for international users

### Rate Limiting
- Implement rate limiting for SMS sending
- Prevent spam and abuse
- Cost management controls

### Error Handling
- Graceful degradation if SMS fails
- Fallback to email notifications
- Comprehensive logging and monitoring

## Cost Considerations

### Twilio Pricing (Approximate)
- **SMS (US)**: $0.0075 per message
- **Voice (US)**: $0.013 per minute  
- **WhatsApp**: $0.005-0.009 per message
- **Verify API**: $0.05 per verification

### Cost Optimization
- Smart message batching
- User preference-based sending
- Time zone optimization
- Message deduplication

## Testing Strategy

### Development Testing
- Twilio test credentials for development
- Mock SMS/voice services for CI/CD
- Test phone numbers for staging

### Production Testing
- Gradual rollout to beta users
- A/B testing for message effectiveness
- Monitoring delivery rates and user engagement

## Deployment Plan

### Phase 1 (Weeks 1-2): SMS Foundation
1. Install Twilio SDK
2. Create basic SMS API routes
3. Update database schema
4. Implement SMS templates
5. Add phone number collection UI

### Phase 2 (Weeks 3-4): Integration & Testing
1. Integrate SMS into existing flows
2. Add notification preferences
3. Implement error handling
4. Conduct thorough testing
5. Deploy to staging

### Phase 3 (Weeks 5-6): Voice & Advanced Features
1. Implement voice calling
2. Add WhatsApp support
3. Create admin dashboard features
4. Performance optimization
5. Production deployment

## Success Metrics

### Technical Metrics
- SMS delivery rate > 95%
- API response time < 500ms
- Zero data breaches or leaks

### User Engagement Metrics  
- SMS opt-in rate > 30%
- Click-through rate on SMS links > 10%
- User satisfaction scores
- Reduced email notification fatigue

## Required API Keys & Secrets

The following Twilio credentials will need to be provided:

### Essential (Phase 1)
1. **TWILIO_ACCOUNT_SID**: Your Twilio Account SID
2. **TWILIO_AUTH_TOKEN**: Your Twilio Auth Token (keep secure!)
3. **TWILIO_PHONE_NUMBER**: Your Twilio phone number for sending SMS

### Optional (Phases 2-3)
4. **TWILIO_MESSAGING_SERVICE_SID**: For better deliverability and compliance
5. **TWILIO_WHATSAPP_NUMBER**: WhatsApp Business number (format: whatsapp:+1234567890)
6. **TWILIO_TWIML_APP_SID**: For voice application features
7. **TWILIO_VERIFY_SERVICE_SID**: For phone number verification

### Webhook URLs (to be configured in Twilio Console)
- SMS Status: `https://your-domain.com/api/twilio/sms/webhook`
- Voice Status: `https://your-domain.com/api/twilio/voice/webhook`
- WhatsApp Status: `https://your-domain.com/api/twilio/whatsapp/webhook`

## Next Steps

1. **Obtain Twilio Account**: Sign up for Twilio and get trial credentials
2. **Review & Approve Plan**: Stakeholder review of this integration plan
3. **Environment Setup**: Configure development environment with Twilio credentials
4. **Begin Phase 1**: Start with SMS foundation implementation
5. **User Testing**: Gather feedback from beta users during development

---

*This plan provides a comprehensive roadmap for integrating Twilio into MentorMate while maintaining the existing email system and ensuring a smooth user experience.*