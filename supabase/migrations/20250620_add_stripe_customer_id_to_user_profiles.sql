-- Add stripe_customer_id column to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN stripe_customer_id TEXT;

-- Add unique constraint to ensure one customer ID per user
ALTER TABLE user_profiles 
ADD CONSTRAINT unique_stripe_customer_id UNIQUE (stripe_customer_id);

-- Add comment to document the column
COMMENT ON COLUMN user_profiles.stripe_customer_id IS 'Stripe customer ID for payment processing'; 