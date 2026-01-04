-- Create approval_status enum type
CREATE TYPE approval_status AS ENUM ('not_submitted', 'submitted', 'approved', 'rejected');

-- Add new approval_status column
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS approval_status approval_status DEFAULT 'not_submitted';

-- Migrate existing data from approved boolean to approval_status
-- If approved = true, set to 'approved'
-- If approved = false, set to 'submitted' (assuming they were submitted for review)
UPDATE public.events 
SET approval_status = CASE 
  WHEN approved = true THEN 'approved'::approval_status
  ELSE 'submitted'::approval_status
END;

-- Drop the old approved column
ALTER TABLE public.events DROP COLUMN IF EXISTS approved;

-- Drop the old index on approved
DROP INDEX IF EXISTS idx_events_approved;

-- Create new index for faster queries on approval status
CREATE INDEX IF NOT EXISTS idx_events_approval_status ON public.events(approval_status);

-- Add comment to explain the column
COMMENT ON COLUMN public.events.approval_status IS 'Approval status of the event: not_submitted (draft), submitted (pending review), or approved (live)';
