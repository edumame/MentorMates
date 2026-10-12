-- Merged migration: Add event approval system
-- This migration adds featured column and approval_status enum to events table

-- Step 1: Add featured column
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;

-- Create index for featured events
CREATE INDEX IF NOT EXISTS idx_events_featured ON public.events(featured) WHERE featured = true;

-- Step 2: Create approval_status enum type
CREATE TYPE approval_status AS ENUM ('not_submitted', 'submitted', 'approved', 'rejected');

-- Step 3: Add approval_status column
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS approval_status approval_status DEFAULT 'not_submitted';

-- Step 4: Auto-approve all public and private events
UPDATE public.events 
SET approval_status = 'approved'::approval_status
WHERE visibility IN ('public', 'private');

-- Step 5: Create index for faster queries on approval status
CREATE INDEX IF NOT EXISTS idx_events_approval_status ON public.events(approval_status);

-- Add comments to document the columns
COMMENT ON COLUMN public.events.featured IS 'Whether this event should be featured on the homepage';
COMMENT ON COLUMN public.events.approval_status IS 'Approval status of the event: not_submitted (draft), submitted (pending review), approved (live), or rejected (declined)';
