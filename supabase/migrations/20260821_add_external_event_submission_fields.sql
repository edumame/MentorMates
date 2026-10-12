-- External event submissions (/events/submit) collect richer info for admin review.
-- expected_attendance is intentionally separate from participant_capacity:
-- participant_capacity enforces registration caps in-app, while expected_attendance
-- is informational only (external events register offsite).
alter table public.events
  add column if not exists submitter_name text,
  add column if not exists organizer_affiliation text,
  add column if not exists expected_attendance integer,
  add column if not exists featured_requested boolean not null default false;

comment on column public.events.submitter_name is 'Name of the person who submitted the event via the public submit form';
comment on column public.events.organizer_affiliation is 'University, company, or organization affiliation of the submitter';
comment on column public.events.expected_attendance is 'Submitter-estimated attendee count; informational, not a registration cap';
comment on column public.events.featured_requested is 'Submitter asked for featured placement; admins still control the featured flag';
