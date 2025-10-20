-- Add event_type column to events table
-- Stores the type of event (e.g., 'hackathon', 'workshop', 'conference')
-- Using TEXT to allow future expansion without enum migrations

alter table public.events
add column if not exists event_type text not null default 'hackathon';

-- Backfill existing rows explicitly in case default isn't applied retroactively
update public.events
set event_type = coalesce(event_type, 'hackathon');

-- Optional: Create an index if filtering by event_type becomes common
-- create index if not exists idx_events_event_type on public.events (event_type);
