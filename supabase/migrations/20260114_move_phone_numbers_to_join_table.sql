-- Move phone numbers from user_profiles to a dedicated join table
-- This allows for multiple phone numbers per user and verification tracking

-- Create phone verification status enum
CREATE TYPE phone_verification_status AS ENUM (
    'unverified',
    'pending',
    'verified',
    'failed',
    'expired'
);

-- Create user_phone_numbers table
CREATE TABLE user_phone_numbers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(uid) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    verification_state TEXT, -- Additional state information (e.g., "code_sent", "code_verified", etc.)
    verification_status phone_verification_status DEFAULT 'unverified' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_user_phone UNIQUE (user_id, phone_number)
);

-- Create indexes for better query performance
CREATE INDEX idx_user_phone_numbers_user_id ON user_phone_numbers(user_id);
CREATE INDEX idx_user_phone_numbers_phone_number ON user_phone_numbers(phone_number);
CREATE INDEX idx_user_phone_numbers_verification_status ON user_phone_numbers(verification_status);

-- Migrate existing phone numbers from user_profiles
INSERT INTO user_phone_numbers (user_id, phone_number, verification_status, created_at)
SELECT 
    uid,
    phone_number,
    'unverified'::phone_verification_status,
    created_at
FROM user_profiles
WHERE phone_number IS NOT NULL AND phone_number != '';

-- Drop the phone_number column from user_profiles
ALTER TABLE user_profiles
DROP COLUMN IF EXISTS phone_number;

-- Add RLS policies
ALTER TABLE user_phone_numbers ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own phone numbers
CREATE POLICY "Users can view own phone numbers"
ON user_phone_numbers FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to insert their own phone numbers
CREATE POLICY "Users can insert own phone numbers"
ON user_phone_numbers FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own phone numbers
CREATE POLICY "Users can update own phone numbers"
ON user_phone_numbers FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own phone numbers
CREATE POLICY "Users can delete own phone numbers"
ON user_phone_numbers FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_user_phone_numbers_updated_at
    BEFORE UPDATE ON user_phone_numbers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE user_phone_numbers IS 'Stores user phone numbers with verification tracking. Users can have multiple phone numbers.';
COMMENT ON COLUMN user_phone_numbers.user_id IS 'Reference to the user profile (uid)';
COMMENT ON COLUMN user_phone_numbers.phone_number IS 'Phone number (text; may include country code, e.g. +1...)';
COMMENT ON COLUMN user_phone_numbers.verification_state IS 'Additional verification state information (e.g., "code_sent", "code_verified", etc.)';
COMMENT ON COLUMN user_phone_numbers.verification_status IS 'Verification status: unverified, pending, verified, failed, or expired';
COMMENT ON TYPE phone_verification_status IS 'Enum for phone number verification status';

