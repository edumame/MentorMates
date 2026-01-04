-- Add featured and approved columns to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;

-- Add comment to explain the columns
COMMENT ON COLUMN public.events.featured IS 'Whether this event should be featured on the homepage';
COMMENT ON COLUMN public.events.approved IS 'Whether this event has been approved by an admin';

-- Create index for faster queries on featured events
CREATE INDEX IF NOT EXISTS idx_events_featured ON public.events(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_events_approved ON public.events(approved) WHERE approved = true;
