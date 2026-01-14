-- Migration: Update approval status flow to match new PRD
-- This migration updates the approval_status enum to support the new approval states:
-- not_submitted, submitted, approved, rejected
-- Note: Visibility (draft, private, public) remains separate in the visibility field
-- Note: Featured is kept as a separate boolean column (not part of approval_status)

-- Step 1: Add rejection_reason column to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON COLUMN public.events.rejection_reason IS 'Reason provided by admin when rejecting an event submission';

-- Step 7: Add rejection_reason column to event_approval_logs for tracking
ALTER TABLE public.event_approval_logs 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON COLUMN public.event_approval_logs.rejection_reason IS 'Reason provided when rejecting an event (stored in logs for history)';
