-- Lane B (audit 2026-11-08): PUB-001, PUB-002, PUB-003
--
-- 1. PUB-003: submitter contact details from the anonymous /events/submit form
--    lived on the publicly readable events row. Move them into an admin-only
--    table and keep the old events columns empty.
-- 2. PUB-001: pending anonymous submissions were inserted as visibility=public
--    (a live open redirect before review). Existing pending/rejected
--    /events/submit submissions are moved back to draft; admin approval sets them public.
-- (Column-level read privileges on events moved to 202611080302_b_round2.sql.)
--
-- DEPLOY ORDER: follow audit-2026-11-08/final/DEPLOY-CHECKLIST.md (XL-004).
-- Do not simply ship app code first: the new app needs objects created by the
-- 20261108 migrations, and the CHECK below makes the old public-submit code
-- fail with 23514.
--
-- Prod pre-check (run first; expect the counts to match after migrating):
--   select count(*) from public.events
--    where submitter_email is not null or submitter_name is not null
--       or organizer_affiliation is not null or expected_attendance is not null;
--
-- Rollback (if needed):
--   alter table public.events drop constraint if exists events_submitter_pii_in_event_submissions;
--   update public.events e set submitter_email = s.submitter_email, submitter_name = s.submitter_name,
--     organizer_affiliation = s.organizer_affiliation, expected_attendance = s.expected_attendance
--   from public.event_submissions s where s.event_id = e.event_id;
--
-- Idempotent: safe to re-run.

-- ── 1. Admin-only submission contact table ─────────────────────────────────
create table if not exists public.event_submissions (
  event_id uuid primary key references public.events(event_id) on delete cascade,
  submitter_email text,
  submitter_name text,
  organizer_affiliation text,
  expected_attendance integer,
  created_at timestamptz not null default now()
);

-- Legacy rows may carry a name/affiliation without an email.
alter table public.event_submissions alter column submitter_email drop not null;

alter table public.event_submissions enable row level security;

revoke all on public.event_submissions from anon;
revoke all on public.event_submissions from authenticated;
grant select on public.event_submissions to authenticated;

drop policy if exists "Admins can view event submissions" on public.event_submissions;
create policy "Admins can view event submissions"
  on public.event_submissions
  for select
  to authenticated
  using (public.is_admin_user((select auth.uid())));

-- Writes happen only through the service role (app/api/events/public-submit).

-- ── 2. Existing pending /events/submit submissions go back to draft ────────
-- (only that form sets submitter_email; signed-in submitters are owners)
-- XL-008: record which events are flipped (and their prior state) first, in
-- the same audit_backup schema as the A2 backups. Re-runs add nothing: a
-- flipped row is no longer public.
create schema if not exists audit_backup;
revoke all on schema audit_backup from public, anon, authenticated;
create table if not exists audit_backup.events_visibility_20261108 (
  event_id uuid primary key,
  old_visibility text not null,
  approval_status text,
  backed_up_at timestamptz not null default now()
);
revoke all on audit_backup.events_visibility_20261108 from public, anon, authenticated;

insert into audit_backup.events_visibility_20261108 (event_id, old_visibility, approval_status)
select event_id, visibility::text, approval_status::text
from public.events
where visibility = 'public'
  and submitter_email is not null
  and approval_status in ('submitted', 'rejected')
on conflict (event_id) do nothing;
-- Rollback for this step:
--   update public.events e set visibility = b.old_visibility::public.event_visibility
--   from audit_backup.events_visibility_20261108 b where b.event_id = e.event_id;

update public.events
set visibility = 'draft'
where visibility = 'public'
  and submitter_email is not null
  and approval_status in ('submitted', 'rejected');

-- ── 1b. Copy then clear the legacy PII columns on events ───────────────────
insert into public.event_submissions (
  event_id, submitter_email, submitter_name, organizer_affiliation, expected_attendance
)
select event_id, submitter_email, submitter_name, organizer_affiliation, expected_attendance
from public.events
where submitter_email is not null
   or submitter_name is not null
   or organizer_affiliation is not null
   or expected_attendance is not null
on conflict (event_id) do nothing;

update public.events
set submitter_email = null,
    submitter_name = null,
    organizer_affiliation = null,
    expected_attendance = null
where submitter_email is not null
   or submitter_name is not null
   or organizer_affiliation is not null
   or expected_attendance is not null;

alter table public.events drop constraint if exists events_submitter_pii_in_event_submissions;
alter table public.events
  add constraint events_submitter_pii_in_event_submissions
  check (
    submitter_email is null
    and submitter_name is null
    and organizer_affiliation is null
    and expected_attendance is null
  );
