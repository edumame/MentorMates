-- Lane D, audit 2026-11-08 round 2.
--
-- 1. PUB-008 / JUDGE-012: member emails (projects.lead_email / teammates)
--    are readable only by the project's members, the event's organizers and
--    admins. 202611080501 revoked them from anon; any signed-up account could
--    still read them through PostgREST. Revoke them from `authenticated` too
--    and expose them through SECURITY DEFINER functions.
-- 2. MENT-003 / MENT-005: mentor slot integrity (booked slots can't be moved,
--    shrunk below their bookings or hard-deleted; cancellation is a soft
--    delete that keeps the cancelled booking rows).
-- 3. MENT-014: DB-backed quota for AI feedback suggestions.
-- 4. MENT-010: drop every pre-existing storage policy that applies only to
--    'profile-images' (prod may have permissive ones that would be OR-ed with
--    ours). Dropped definitions go to audit_backup.storage_policies_20261108;
--    multi-bucket policies are kept and reported (XL-008).
--
-- PROD PRE-CHECK (run first, read-only):
--   -- column privileges currently held on projects
--   select grantee, column_name, privilege_type from information_schema.column_privileges
--    where table_schema = 'public' and table_name = 'projects' and grantee in ('anon','authenticated')
--    order by 1, 2;
--   -- columns that exist on prod (the grant list below must cover all non-email columns)
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'projects' order by ordinal_position;
--   -- policies/views that read the email columns as the caller (would start failing)
--   select schemaname, tablename, policyname from pg_policies
--    where coalesce(qual,'') || coalesce(with_check,'') ~ '(lead_email|teammates)';
--   select viewname from pg_views where definition ~ '(lead_email|teammates)';
--   -- storage policies that mention the avatar bucket
--   select policyname, cmd, qual, with_check from pg_policies
--    where schemaname = 'storage' and tablename = 'objects'
--      and coalesce(qual,'') || coalesce(with_check,'') like '%profile-images%';

set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. Team emails
-- ---------------------------------------------------------------------------

-- Case-insensitive membership (stored emails are not normalised).
create or replace function public.caller_auth_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(u.email) from auth.users u where u.id = auth.uid();
$$;
revoke all on function public.caller_auth_email() from public, anon;
grant execute on function public.caller_auth_email() to authenticated;

-- Projects the caller leads or is a teammate on (optionally within one event).
create or replace function public.my_project_ids(p_event_id uuid default null)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.projects p
  where public.caller_auth_email() is not null
    and (p_event_id is null or p.event_id = p_event_id)
    and (
      lower(coalesce(p.lead_email, '')) = public.caller_auth_email()
      or exists (
        select 1 from unnest(coalesce(p.teammates, '{}'::text[])) t
        where lower(t) = public.caller_auth_email()
      )
    );
$$;
revoke all on function public.my_project_ids(uuid) from public, anon;
grant execute on function public.my_project_ids(uuid) to authenticated;

-- Projects of an arbitrary user (public profile pages). Service role only:
-- the caller must decide what of those projects to show.
create or replace function public.project_ids_for_user(p_user_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.projects p
  join auth.users u on u.id = p_user_id
  where u.email is not null
    and (
      lower(coalesce(p.lead_email, '')) = lower(u.email)
      or exists (
        select 1 from unnest(coalesce(p.teammates, '{}'::text[])) t
        where lower(t) = lower(u.email)
      )
    );
$$;
revoke all on function public.project_ids_for_user(uuid) from public, anon, authenticated;
grant execute on function public.project_ids_for_user(uuid) to service_role;

-- Emails for the given projects, only where the caller is a team member, an
-- organizer of the project's event, or an admin. Other ids are silently
-- omitted (same shape for "no access" and "no such project").
create or replace function public.project_team_emails(p_project_ids uuid[])
returns table (project_id uuid, lead_email text, teammates text[])
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.lead_email, coalesce(p.teammates, '{}'::text[])
  from public.projects p
  where p.id = any(coalesce(p_project_ids, '{}'::uuid[]))
    and auth.uid() is not null
    and (
      public.is_project_team_member(p.id, auth.uid())
      or (p.event_id is not null and public.is_event_organizer(p.event_id, auth.uid()))
      or public.is_admin_user(auth.uid())
    );
$$;
revoke all on function public.project_team_emails(uuid[]) from public, anon;
grant execute on function public.project_team_emails(uuid[]) to authenticated;

-- Used by the platform_engagement policy, which read projects.lead_email as
-- the caller and would fail once the column grant is gone.
create or replace function public.caller_leads_project_in_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.event_id = p_event_id
      and lower(coalesce(p.lead_email, '')) = public.caller_auth_email()
  );
$$;
revoke all on function public.caller_leads_project_in_event(uuid) from public, anon;
grant execute on function public.caller_leads_project_in_event(uuid) to authenticated;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'platform_engagement'
      and policyname = 'Users can view their own entries and entries for events they''re'
  ) then
    execute 'alter policy "Users can view their own entries and entries for events they''re" on public.platform_engagement
      using ((select auth.uid()) = user_id or public.caller_leads_project_in_event(event_id))';
  end if;
end
$$;

-- Same column set for both client roles. NOTE: a column added to
-- public.projects later is not readable by anon/authenticated until it is
-- added here.
revoke select on table public.projects from anon, authenticated;
grant select (
  id,
  lead_name,
  project_description,
  created_at,
  project_name,
  project_url,
  additional_materials_url,
  event_id,
  cover_image_url,
  video_url,
  submitted,
  submitted_at,
  contextus_project_id,
  private
) on table public.projects to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Mentor slots
-- ---------------------------------------------------------------------------

alter table public.mentor_availability
  add column if not exists cancelled_at timestamptz;

create or replace function public.mentor_availability_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  confirmed_count integer := 0;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('mentor_availability:' || new.mentor_id::text || ':' || new.event_id::text, 0)
  );

  if new.end_time <= new.start_time then
    raise exception 'End time must be after start time' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and new.end_time <= now() then
    raise exception 'Availability must end in the future' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    select count(*) into confirmed_count
    from public.mentor_bookings
    where availability_id = new.id and status = 'confirmed';

    if confirmed_count > 0 and (
      new.start_time is distinct from old.start_time
      or new.end_time is distinct from old.end_time
      or new.mentor_id is distinct from old.mentor_id
      or new.event_id is distinct from old.event_id
    ) then
      raise exception 'Cancel the bookings on this slot before changing its time'
        using errcode = '23514';
    end if;
    if new.max_bookings < confirmed_count then
      raise exception 'This slot already has % confirmed bookings', confirmed_count
        using errcode = '23514';
    end if;
    if new.cancelled_at is not null and old.cancelled_at is null and confirmed_count > 0 then
      raise exception 'Use cancel_mentor_slot to cancel a booked slot' using errcode = '23514';
    end if;
    -- Nothing else to validate for a cancellation or capacity-only change.
    if new.start_time = old.start_time and new.end_time = old.end_time
       and new.mentor_id = old.mentor_id and new.event_id = old.event_id then
      return new;
    end if;
  end if;

  if new.end_time - new.start_time > interval '8 hours' then
    raise exception 'Availability slots can be at most 8 hours long' using errcode = '23514';
  end if;

  if new.cancelled_at is null and exists (
    select 1
    from public.mentor_availability other
    where other.mentor_id = new.mentor_id
      and other.event_id = new.event_id
      and other.id <> new.id
      and other.cancelled_at is null
      and tstzrange(other.start_time, other.end_time) && tstzrange(new.start_time, new.end_time)
  ) then
    raise exception 'This overlaps one of your existing availability slots' using errcode = '23P01';
  end if;

  return new;
end
$$;

drop trigger if exists mentor_availability_guard on public.mentor_availability;
create trigger mentor_availability_guard
  before insert or update of start_time, end_time, mentor_id, event_id, max_bookings, cancelled_at
  on public.mentor_availability
  for each row execute function public.mentor_availability_guard();

-- Direct DELETE (e.g. PostgREST) of a slot with any booking history is
-- refused; cancellations go through cancel_mentor_slot and keep the rows.
-- Cascades from deleting the event/mentor (trigger depth > 1) still work.
create or replace function public.mentor_availability_delete_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if pg_trigger_depth() <= 1 and exists (
    select 1 from public.mentor_bookings where availability_id = old.id
  ) then
    raise exception 'Slots with bookings are cancelled, not deleted' using errcode = '23514';
  end if;
  return old;
end
$$;

drop trigger if exists mentor_availability_delete_guard on public.mentor_availability;
create trigger mentor_availability_delete_guard
  before delete on public.mentor_availability
  for each row execute function public.mentor_availability_delete_guard();

-- Atomic cancel: lock the slot, refuse without p_force when booked, mark
-- bookings cancelled, then soft-delete (booked) or delete (never booked).
-- Returns the participant ids whose bookings were cancelled.
create or replace function public.cancel_mentor_slot(p_availability_id uuid, p_force boolean default false)
returns table (participant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  slot public.mentor_availability;
  confirmed_count integer;
  has_history boolean;
begin
  select * into slot from public.mentor_availability where id = p_availability_id for update;
  if not found or slot.cancelled_at is not null then
    raise exception 'Slot not found' using errcode = 'P0002';
  end if;
  if actor is null or not (
    slot.mentor_id = actor
    or public.is_event_organizer(slot.event_id, actor)
    or public.is_admin_user(actor)
  ) then
    raise exception 'Not allowed to cancel this slot' using errcode = '42501';
  end if;

  select count(*) into confirmed_count
  from public.mentor_bookings where availability_id = slot.id and status = 'confirmed';
  if confirmed_count > 0 and not coalesce(p_force, false) then
    raise exception 'This slot has % confirmed booking(s)', confirmed_count using errcode = 'P0001';
  end if;

  return query
    update public.mentor_bookings b
       set status = 'cancelled'
     where b.availability_id = slot.id and b.status = 'confirmed'
    returning b.participant_id;

  select exists (select 1 from public.mentor_bookings where availability_id = slot.id) into has_history;
  if has_history then
    update public.mentor_availability set cancelled_at = now() where id = slot.id;
  else
    delete from public.mentor_availability where id = slot.id;
  end if;
end
$$;
revoke all on function public.cancel_mentor_slot(uuid, boolean) from public, anon;
grant execute on function public.cancel_mentor_slot(uuid, boolean) to authenticated;

-- Booking must not target a cancelled slot.
create or replace function public.book_mentor_slot(p_event_id uuid, p_availability_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  slot public.mentor_availability;
  booking public.mentor_bookings;
  active_count integer;
begin
  if actor is null or not exists (
    select 1 from public.user_event_roles where event_id = p_event_id and user_id = actor
  ) then
    raise exception 'Event membership required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.user_event_roles
    where event_id = p_event_id and user_id = actor and role = 'participant'
  ) then
    raise exception 'Only participants can book mentor sessions' using errcode = '42501';
  end if;

  select * into slot from public.mentor_availability
  where id = p_availability_id and event_id = p_event_id and cancelled_at is null
  for update;
  if not found then
    raise exception 'Slot not found' using errcode = 'P0002';
  end if;
  if slot.mentor_id = actor then
    raise exception 'Mentors cannot book their own slot' using errcode = '22023';
  end if;
  if slot.end_time <= clock_timestamp() then
    raise exception 'This slot has ended' using errcode = '23514';
  end if;

  select * into booking from public.mentor_bookings
  where availability_id = slot.id and participant_id = actor;
  if found and booking.status = 'confirmed' then
    return to_jsonb(booking);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mentor_booking:' || actor::text, 0));

  if exists (
    select 1
    from public.mentor_bookings b
    join public.mentor_availability a on a.id = b.availability_id
    where b.participant_id = actor
      and b.status = 'confirmed'
      and a.id <> slot.id
      and a.cancelled_at is null
      and tstzrange(a.start_time, a.end_time) && tstzrange(slot.start_time, slot.end_time)
  ) then
    raise exception 'You already have a mentor session at this time' using errcode = '23514';
  end if;

  select count(*) into active_count from public.mentor_bookings
  where availability_id = slot.id and status = 'confirmed';
  if active_count >= slot.max_bookings then
    raise exception 'Slot is fully booked' using errcode = '23514';
  end if;

  insert into public.mentor_bookings(availability_id, participant_id, status)
  values (slot.id, actor, 'confirmed')
  on conflict (availability_id, participant_id)
  do update set status = 'confirmed', booked_at = now()
  returning * into booking;
  return to_jsonb(booking);
end
$$;
revoke all on function public.book_mentor_slot(uuid, uuid) from public, anon;
grant execute on function public.book_mentor_slot(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. AI suggestion quota (service role only)
-- ---------------------------------------------------------------------------

create table if not exists public.feedback_suggestion_usage (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists feedback_suggestion_usage_user_time
  on public.feedback_suggestion_usage (user_id, created_at desc);
alter table public.feedback_suggestion_usage enable row level security;
revoke all on table public.feedback_suggestion_usage from anon, authenticated;

-- Atomically records one use when under the limit; returns false when the
-- caller has used p_limit suggestions within p_window.
create or replace function public.consume_feedback_suggestion_quota(
  p_user_id uuid, p_limit integer, p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('feedback_suggestion:' || p_user_id::text, 0));
  delete from public.feedback_suggestion_usage
   where user_id = p_user_id and created_at < now() - interval '7 days';
  select count(*) into used from public.feedback_suggestion_usage
   where user_id = p_user_id and created_at > now() - p_window;
  if used >= p_limit then
    return false;
  end if;
  insert into public.feedback_suggestion_usage(user_id) values (p_user_id);
  return true;
end
$$;
revoke all on function public.consume_feedback_suggestion_quota(uuid, integer, interval) from public, anon, authenticated;
grant execute on function public.consume_feedback_suggestion_quota(uuid, integer, interval) to service_role;

-- ---------------------------------------------------------------------------
-- 4. profile-images storage policies
-- ---------------------------------------------------------------------------

-- XL-008: drop only policies whose every bucket_id test is
-- bucket_id = 'profile-images'. A policy that also covers another bucket
-- (e.g. bucket_id = ANY (ARRAY['profile-images', 'project-materials'])) is
-- kept and reported with a WARNING for a manual decision. Each dropped
-- policy is saved in audit_backup.storage_policies_20261108 first
-- (re-runs keep the first saved definition per name).
create schema if not exists audit_backup;
revoke all on schema audit_backup from public, anon, authenticated;
create table if not exists audit_backup.storage_policies_20261108 (
  policyname name primary key,
  permissive text,
  roles name[],
  cmd text,
  qual text,
  with_check text,
  backed_up_at timestamptz not null default now()
);
revoke all on audit_backup.storage_policies_20261108 from public, anon, authenticated;

do $$
declare
  pol record;
  v_text text;
  v_bucket_refs integer;
  v_profile_refs integer;
begin
  for pol in
    select policyname, permissive, roles, cmd, qual, with_check from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and coalesce(qual, '') || coalesce(with_check, '') like '%profile-images%'
  loop
    v_text := coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '');
    select count(*) into v_bucket_refs from regexp_matches(v_text, 'bucket_id', 'g');
    select count(*) into v_profile_refs
      from regexp_matches(v_text, 'bucket_id = ''profile-images''(::text)?', 'g');
    if v_bucket_refs = 0 or v_bucket_refs <> v_profile_refs then
      raise warning 'D 0505 MENT-010: storage policy % mentions profile-images but also other buckets (or no bucket_id test); NOT dropped, review manually', pol.policyname;
      continue;
    end if;
    insert into audit_backup.storage_policies_20261108 (policyname, permissive, roles, cmd, qual, with_check)
    values (pol.policyname, pol.permissive, pol.roles, pol.cmd, pol.qual, pol.with_check)
    on conflict (policyname) do nothing;
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end
$$;

drop policy if exists "Users upload own profile images" on storage.objects;
create policy "Users upload own profile images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and name like 'avatars/' || (select auth.uid())::text || '-%'
  );

drop policy if exists "Users update own profile images" on storage.objects;
create policy "Users update own profile images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-images'
    and name like 'avatars/' || (select auth.uid())::text || '-%'
  )
  with check (
    bucket_id = 'profile-images'
    and name like 'avatars/' || (select auth.uid())::text || '-%'
  );

drop policy if exists "Users delete own profile images" on storage.objects;
create policy "Users delete own profile images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-images'
    and name like 'avatars/' || (select auth.uid())::text || '-%'
  );

notify pgrst, 'reload schema';
