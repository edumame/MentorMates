-- Add phone number support to user profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_notifications_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP WITH TIME ZONE;

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  voice_enabled BOOLEAN DEFAULT false,
  whatsapp_enabled BOOLEAN DEFAULT false,
  project_submission_email BOOLEAN DEFAULT true,
  project_submission_sms BOOLEAN DEFAULT false,
  feedback_email BOOLEAN DEFAULT true,
  feedback_sms BOOLEAN DEFAULT false,
  event_reminders_email BOOLEAN DEFAULT true,
  event_reminders_sms BOOLEAN DEFAULT false,
  team_invitations_email BOOLEAN DEFAULT true,
  team_invitations_sms BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create SMS logs table for tracking
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phone_number VARCHAR(20) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  message_content TEXT NOT NULL,
  twilio_message_sid VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  error_message TEXT,
  cost_usd DECIMAL(10,6), -- Track costs for analytics
  character_count INTEGER
);

-- Create voice call logs table for future voice features
CREATE TABLE IF NOT EXISTS voice_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phone_number VARCHAR(20) NOT NULL,
  call_type VARCHAR(50) NOT NULL,
  twilio_call_sid VARCHAR(50),
  status VARCHAR(20) DEFAULT 'initiated',
  duration_seconds INTEGER,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  cost_usd DECIMAL(10,6)
);

-- Create WhatsApp logs table for future WhatsApp features
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phone_number VARCHAR(20) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  message_content TEXT NOT NULL,
  media_url TEXT,
  twilio_message_sid VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  cost_usd DECIMAL(10,6)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sms_logs_user_id ON sms_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_phone_number ON sms_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_twilio_sid ON sms_logs(twilio_message_sid);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_at ON sms_logs(sent_at);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON notification_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_voice_logs_user_id ON voice_call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_logs_twilio_sid ON voice_call_logs(twilio_call_sid);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_user_id ON whatsapp_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_twilio_sid ON whatsapp_logs(twilio_message_sid);

-- Add updated_at trigger for notification_preferences
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notification_preferences_updated_at 
    BEFORE UPDATE ON notification_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sms_logs_updated_at 
    BEFORE UPDATE ON sms_logs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies

-- Enable RLS on all new tables
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Notification preferences policies
CREATE POLICY "Users can view their own notification preferences" ON notification_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences" ON notification_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences" ON notification_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- SMS logs policies (users can view their own logs, admins can view all)
CREATE POLICY "Users can view their own SMS logs" ON sms_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Admin policies (assuming you have an admin role system)
CREATE POLICY "Admins can view all SMS logs" ON sms_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_event_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Service role can insert/update SMS logs (for API operations)
CREATE POLICY "Service can manage SMS logs" ON sms_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Similar policies for voice and WhatsApp logs
CREATE POLICY "Users can view their own voice logs" ON voice_call_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage voice logs" ON voice_call_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own WhatsApp logs" ON whatsapp_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage WhatsApp logs" ON whatsapp_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Create a function to initialize default notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default preferences when a user is created
-- Note: This assumes the trigger will be on the auth.users table
-- You may need to adjust based on your user creation flow
CREATE OR REPLACE TRIGGER create_user_notification_preferences
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_preferences();

-- Add comments for documentation
COMMENT ON TABLE notification_preferences IS 'User notification preferences for email, SMS, voice, and WhatsApp';
COMMENT ON TABLE sms_logs IS 'Log of all SMS messages sent through Twilio';
COMMENT ON TABLE voice_call_logs IS 'Log of all voice calls made through Twilio';
COMMENT ON TABLE whatsapp_logs IS 'Log of all WhatsApp messages sent through Twilio';

COMMENT ON COLUMN user_profiles.phone_number IS 'User phone number in E.164 format';
COMMENT ON COLUMN user_profiles.phone_verified IS 'Whether the phone number has been verified';
COMMENT ON COLUMN sms_logs.cost_usd IS 'Cost of SMS in USD for analytics';
COMMENT ON COLUMN sms_logs.character_count IS 'Number of characters in the message';