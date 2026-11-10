-- A2 round 2 (critic + verifier follow-ups, audit-2026-11-08).
--
-- PROD PRE-CHECKS (read-only; run before applying and record the results):
--   -- roles that organizers added for users who never filed a request/accepted
--   -- an invite cannot be told apart afterwards; count non-organizer roles per event
--   select role, count(*) from public.user_event_roles group by role;
--   -- legacy pending staff-role approval requests closed by section 6
--   select requested_role, count(*) from public.participant_approval_requests
--    where status = 'pending' and requested_role <> 'participant' group by 1;
--   -- unapproved public events (left as they are; only new ones are blocked)
--   select count(*) from public.events
--    where visibility = 'public' and coalesce(approval_status::text, '') <> 'approved';

-- 1. Forced enrolment (ORG-002 / ORG-012 / ORG-019 chain) ---------------------
-- Any signed-in user can create an event and becomes its organizer. Organizers
-- could insert ANY user_id as participant/judge/mentor, which made that user's
-- profile (email) readable to them and made the user a valid recipient of the
-- event email routes. New members are now added only with their consent:
--   * invitations (judge/organizer/participant) accepted by the invitee
--     (service role, app/api/events/[eventId]/accept-invite);
--   * self-service joins (service role, app/api/roles/verify);
--   * approval requests the person filed themself: an organizer may insert the
--     participant role only for a user with an approved participant request.
-- Organizers can still change roles of existing members (UPDATE policy), but
-- can no longer re-point a row to another user/event.
-- Security definer so the policy does not re-enter participant_approval_requests
-- RLS (whose policies read user_event_roles -> infinite recursion).
create or replace function public.has_approved_participant_request(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.participant_approval_requests r
     where r.event_id = p_event_id
       and r.user_id = p_user_id
       and r.requested_role = 'participant'
       and r.status = 'approved'
  );
$$;
revoke all on function public.has_approved_participant_request(uuid, uuid) from public, anon;
grant execute on function public.has_approved_participant_request(uuid, uuid) to authenticated, service_role;

drop policy if exists "Organizers and admins can assign roles to events" on public.user_event_roles;
create policy "Organizers and admins can assign roles to events"
  on public.user_event_roles
  for insert
  to authenticated
  with check (
    public.is_admin_user((select auth.uid()))
    or (
      public.is_event_organizer(event_id, (select auth.uid()))
      and role = 'participant'
      and public.has_approved_participant_request(event_id, user_id)
    )
  );

create or replace function public.pin_user_event_role_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated')
     and (new.user_id is distinct from old.user_id or new.event_id is distinct from old.event_id) then
    raise exception 'A role cannot be moved to another user or event' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists pin_user_event_role_identity on public.user_event_roles;
create trigger pin_user_event_role_identity
  before update on public.user_event_roles
  for each row execute function public.pin_user_event_role_identity();

-- Organizer-managed team rows may only reference members of the event.
drop policy if exists "Organizers manage team members" on public.team_members;
create policy "Organizers manage team members"
  on public.team_members
  for all
  to authenticated
  using (
    public.is_event_organizer(event_id, (select auth.uid()))
    or public.is_admin_user((select auth.uid()))
  )
  with check (
    (
      public.is_event_organizer(event_id, (select auth.uid()))
      or public.is_admin_user((select auth.uid()))
    )
    and public.user_has_event_role(event_id, user_id)
    and exists (
      select 1 from public.teams t
       where t.id = team_members.team_id
         and t.event_id = team_members.event_id
    )
  );

-- user_profiles SELECT keeps its organizer branch: organizers need member
-- emails (People tab, Copy emails, CSV export). With the consent rule above,
-- that branch now only covers people who joined, accepted an invite or filed
-- a request for the organizer's event.

-- 2. Publish guard also on INSERT (ORG-002) ---------------------------------
create or replace function public.guard_event_ownership_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Invoker rights are intentional: current_user is the actual database role.
  if current_user in ('postgres', 'service_role', 'supabase_admin')
     or public.is_admin_user(auth.uid()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.visibility = 'public'
       and coalesce(new.approval_status::text, 'not_submitted') <> 'approved' then
      raise exception 'Events can only be made public after they are approved' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'Only administrators may transfer event ownership' using errcode = '42501';
  end if;

  if new.visibility = 'public'
     and old.visibility is distinct from 'public'
     and coalesce(new.approval_status::text, 'not_submitted') <> 'approved' then
    raise exception 'Events can only be made public after they are approved' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_event_ownership_fields on public.events;
create trigger guard_event_ownership_fields
  before insert or update on public.events
  for each row execute function public.guard_event_ownership_fields();

-- 3. Atomic, escalating role-password throttle (ORG-013) --------------------
alter table public.role_password_attempts
  add column if not exists lockout_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz;

create table if not exists public.role_password_event_attempts (
  event_id uuid not null references public.events(event_id) on delete cascade,
  role public.event_role not null,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  locked_until timestamptz,
  primary key (event_id, role)
);
alter table public.role_password_event_attempts enable row level security;
revoke all on public.role_password_event_attempts from anon, authenticated;

drop function if exists public.role_password_locked_until(uuid, uuid, public.event_role);
drop function if exists public.record_role_password_failure(uuid, uuid, public.event_role, integer, interval);

-- Consumes one attempt BEFORE the password is compared. Rows are locked, so
-- concurrent requests are counted one by one. Every attempt counts; a correct
-- password refunds it (clear_role_password_failures).
--   per user+event+role: p_max_attempts per p_window; the next attempt locks
--     the user for p_window * 2^(lockouts-1) (max 24h). failed_count decays by
--     one per elapsed p_window; lockout_count only resets after 24h without
--     attempts or on success.
--   per event+role (all users): p_event_max attempts per p_event_window, so
--     fresh accounts do not get fresh budgets.
create or replace function public.consume_role_password_attempt(
  p_user_id uuid,
  p_event_id uuid,
  p_role public.event_role,
  p_max_attempts integer default 5,
  p_window interval default interval '15 minutes',
  p_event_max integer default 50,
  p_event_window interval default interval '1 hour'
)
returns table (allowed boolean, retry_at timestamptz, scope text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.role_password_event_attempts;
  v_user public.role_password_attempts;
  v_decay integer;
begin
  insert into public.role_password_event_attempts (event_id, role)
  values (p_event_id, p_role) on conflict do nothing;
  select * into v_event from public.role_password_event_attempts
   where event_id = p_event_id and role = p_role for update;

  if v_event.locked_until > now() then
    return query select false, v_event.locked_until, 'event'::text;
    return;
  end if;
  if v_event.window_started_at < now() - p_event_window then
    v_event.window_started_at := now();
    v_event.attempt_count := 0;
  end if;
  v_event.attempt_count := v_event.attempt_count + 1;
  if v_event.attempt_count > p_event_max then
    v_event.locked_until := v_event.window_started_at + p_event_window;
  end if;
  update public.role_password_event_attempts
     set window_started_at = v_event.window_started_at,
         attempt_count = v_event.attempt_count,
         locked_until = v_event.locked_until
   where event_id = p_event_id and role = p_role;
  if v_event.locked_until > now() then
    return query select false, v_event.locked_until, 'event'::text;
    return;
  end if;

  insert into public.role_password_attempts (user_id, event_id, role, failed_count, window_started_at)
  values (p_user_id, p_event_id, p_role, 0, now()) on conflict do nothing;
  select * into v_user from public.role_password_attempts
   where user_id = p_user_id and event_id = p_event_id and role = p_role for update;

  if v_user.locked_until > now() then
    return query select false, v_user.locked_until, 'user'::text;
    return;
  end if;

  if v_user.last_attempt_at is not null then
    if v_user.last_attempt_at < now() - interval '24 hours' then
      v_user.lockout_count := 0;
      v_user.failed_count := 0;
    else
      v_decay := floor(extract(epoch from (now() - v_user.last_attempt_at)) / extract(epoch from p_window))::integer;
      v_user.failed_count := greatest(v_user.failed_count - v_decay, 0);
    end if;
  end if;

  v_user.failed_count := v_user.failed_count + 1;
  if v_user.failed_count > p_max_attempts then
    v_user.lockout_count := v_user.lockout_count + 1;
    v_user.locked_until := now() + least(
      p_window * power(2, v_user.lockout_count - 1),
      interval '24 hours'
    );
    v_user.failed_count := 0;
  end if;

  update public.role_password_attempts
     set failed_count = v_user.failed_count,
         lockout_count = v_user.lockout_count,
         locked_until = v_user.locked_until,
         last_attempt_at = now()
   where user_id = p_user_id and event_id = p_event_id and role = p_role;

  if v_user.locked_until > now() then
    return query select false, v_user.locked_until, 'user'::text;
    return;
  end if;
  return query select true, null::timestamptz, null::text;
end;
$$;

-- Correct password: reset the user's counters and refund the event attempt.
create or replace function public.clear_role_password_failures(
  p_user_id uuid, p_event_id uuid, p_role public.event_role
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.role_password_attempts
   where user_id = p_user_id and event_id = p_event_id and role = p_role;
  update public.role_password_event_attempts
     set attempt_count = greatest(attempt_count - 1, 0)
   where event_id = p_event_id and role = p_role;
$$;

revoke all on function public.consume_role_password_attempt(uuid, uuid, public.event_role, integer, interval, integer, interval) from public, anon, authenticated;
revoke all on function public.clear_role_password_failures(uuid, uuid, public.event_role) from public, anon, authenticated;
grant execute on function public.consume_role_password_attempt(uuid, uuid, public.event_role, integer, interval, integer, interval) to service_role;
grant execute on function public.clear_role_password_failures(uuid, uuid, public.event_role) to service_role;

-- 4. Invite send quota (ORG-012) --------------------------------------------
create table if not exists public.invite_send_quota (
  scope text not null check (scope in ('inviter', 'event')),
  scope_id uuid not null,
  window_started_at timestamptz not null default now(),
  sent_count integer not null default 0,
  primary key (scope, scope_id)
);
alter table public.invite_send_quota enable row level security;
revoke all on public.invite_send_quota from anon, authenticated;

-- Reserves one invitation for the inviter and the event (fixed 24h windows).
create or replace function public.consume_invite_quota(
  p_inviter_id uuid,
  p_event_id uuid,
  p_inviter_max integer default 50,
  p_event_max integer default 100,
  p_window interval default interval '24 hours'
)
returns table (allowed boolean, retry_at timestamptz, scope text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_row public.invite_send_quota;
  v_scope text;
  v_id uuid;
  v_max integer;
begin
  -- Lock both counters first (fixed order) so concurrent sends serialize.
  insert into public.invite_send_quota (scope, scope_id) values
    ('event', p_event_id), ('inviter', p_inviter_id)
  on conflict do nothing;
  perform 1 from public.invite_send_quota
   where (scope = 'event' and scope_id = p_event_id)
      or (scope = 'inviter' and scope_id = p_inviter_id)
   order by scope
   for update;

  foreach v_scope in array array['event', 'inviter'] loop
    v_id := case v_scope when 'event' then p_event_id else p_inviter_id end;
    v_max := case v_scope when 'event' then p_event_max else p_inviter_max end;
    select * into v_row from public.invite_send_quota where scope = v_scope and scope_id = v_id;
    if v_row.window_started_at < now() - p_window then
      update public.invite_send_quota set window_started_at = now(), sent_count = 0
       where scope = v_scope and scope_id = v_id;
      v_row.sent_count := 0;
      v_row.window_started_at := now();
    end if;
    if v_row.sent_count >= v_max then
      return query select false, v_row.window_started_at + p_window, v_scope;
      return;
    end if;
  end loop;

  update public.invite_send_quota set sent_count = sent_count + 1
   where (scope = 'event' and scope_id = p_event_id)
      or (scope = 'inviter' and scope_id = p_inviter_id);
  return query select true, null::timestamptz, null::text;
end;
$$;

revoke all on function public.consume_invite_quota(uuid, uuid, integer, integer, interval) from public, anon, authenticated;
grant execute on function public.consume_invite_quota(uuid, uuid, integer, integer, interval) to service_role;

-- 5. Feedback display name (MENT-001) ---------------------------------------
-- mentor_name is always derived: NULL for unattributed feedback, otherwise the
-- author's profile display name. Applies to every caller.
create or replace function public.enforce_feedback_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_display_name text;
begin
  -- Never stored, for any caller (MENT-002).
  new.mentor_email := null;

  if tg_op = 'UPDATE' and coalesce(auth.role(), '') in ('anon', 'authenticated') then
    -- Authors may edit the text of their feedback, never move or re-attribute it.
    new.project_id := old.project_id;
    new.event_id := old.event_id;
    new.mentor_id := old.mentor_id;
    new.created_at := old.created_at;
  elsif tg_op = 'INSERT' and coalesce(auth.role(), '') in ('anon', 'authenticated') then
    -- The event always follows the project; clients cannot pick it.
    new.event_id := public.project_event_id(new.project_id);
  end if;

  if new.mentor_id is null then
    new.mentor_name := null;
  elsif tg_op = 'INSERT' or new.mentor_id is distinct from old.mentor_id
        or new.mentor_name is distinct from old.mentor_name then
    select nullif(btrim(display_name), '') into v_display_name
      from public.user_profiles where uid = new.mentor_id;
    new.mentor_name := v_display_name;
  end if;

  return new;
end;
$$;

-- 6. Legacy pending staff-role approval requests (ORG-017) ------------------
create schema if not exists audit_backup;
revoke all on schema audit_backup from public, anon, authenticated;
create table if not exists audit_backup.approval_requests_staff_pending_20261108 (
  id uuid primary key,
  requested_role public.event_role,
  status public.participant_request_status,
  captured_at timestamptz not null default now()
);
revoke all on audit_backup.approval_requests_staff_pending_20261108 from public, anon, authenticated;
insert into audit_backup.approval_requests_staff_pending_20261108 (id, requested_role, status)
select id, requested_role, status from public.participant_approval_requests
 where status = 'pending' and requested_role <> 'participant'
on conflict (id) do nothing;
update public.participant_approval_requests
   set status = 'rejected',
       rejection_reason = 'Staff roles require an invitation from an organizer',
       updated_at = now()
 where status = 'pending' and requested_role <> 'participant';

-- 7. Member removal in one transaction (ORG-008) ----------------------------
-- Called by app/api/events/[eventId]/participants/[userId] with the service
-- role AFTER it authorized the organizer and the target. Removes the role,
-- the user's team memberships in the event (promoting the longest-standing
-- remaining member to lead when the removed user led a team) and closes an
-- approved participant request. Returns NULL when no role row existed.
create or replace function public.remove_event_member(
  p_event_id uuid, p_user_id uuid, p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
  v_teams integer := 0;
  v_promoted integer := 0;
  v_closed integer := 0;
  v_team record;
  v_next uuid;
begin
  delete from public.user_event_roles where event_id = p_event_id and user_id = p_user_id;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    return null;
  end if;

  for v_team in
    delete from public.team_members
     where event_id = p_event_id and user_id = p_user_id
    returning team_id, role
  loop
    v_teams := v_teams + 1;
    if v_team.role = 'lead' and not exists (
      select 1 from public.team_members where team_id = v_team.team_id and role = 'lead'
    ) then
      select id into v_next from public.team_members
       where team_id = v_team.team_id
       order by joined_at asc nulls last, id
       limit 1;
      if v_next is not null then
        update public.team_members set role = 'lead' where id = v_next;
        v_promoted := v_promoted + 1;
      end if;
    end if;
  end loop;

  update public.participant_approval_requests
     set status = 'rejected',
         rejection_reason = 'Removed from the event by an organizer',
         reviewed_by = p_actor_id,
         reviewed_at = now(),
         updated_at = now()
   where event_id = p_event_id and user_id = p_user_id and status = 'approved';
  get diagnostics v_closed = row_count;

  return jsonb_build_object(
    'removedTeamMemberships', v_teams,
    'promotedTeamLeads', v_promoted,
    'closedApprovalRequests', v_closed
  );
end;
$$;

revoke all on function public.remove_event_member(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_event_member(uuid, uuid, uuid) to service_role;

-- 8. role_passwords rows are no longer listable by every signed-in user ------
-- Organizers/admins of the event may read (event_id, role) rows (the hash
-- column stays unreadable through column grants). Join dialogs ask
-- public.event_password_roles(event_id), which returns only the role names
-- that have a password for one event the caller can see.
drop policy if exists "Authenticated users can view all role passwords for verificatio" on public.role_passwords;
drop policy if exists "Event organizers can view their role passwords" on public.role_passwords;
create policy "Event organizers can view their role passwords"
  on public.role_passwords
  for select
  to authenticated
  using (
    public.is_event_organizer(event_id, (select auth.uid()))
    or public.is_admin_user((select auth.uid()))
  );

create or replace function public.event_password_roles(p_event_id uuid)
returns setof public.event_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select rp.role
    from public.role_passwords rp
    join public.events e on e.event_id = rp.event_id
   where rp.event_id = p_event_id
     and (
       e.visibility in ('public', 'private')
       or ((select auth.uid()) is not null
           and (public.user_has_event_role(e.event_id, (select auth.uid()))
                or e.owner_id = (select auth.uid())))
     );
$$;

revoke all on function public.event_password_roles(uuid) from public;
grant execute on function public.event_password_roles(uuid) to anon, authenticated, service_role;

-- 9. Feedback SELECT without self-lookups (MENT-001 follow-up) ---------------
-- is_feedback_public(id)/can_view_feedback(id) look the row up by id, which
-- cannot see a row inserted by the same statement, so INSERT ... RETURNING
-- (PostgREST return=representation) failed for legitimate authors. Same
-- visibility rules, evaluated on the row's own columns, plus authors always
-- see their own feedback.
drop policy if exists "Anyone can view feedback on public projects and event participa" on public.feedback;
drop policy if exists "Feedback is visible on public projects, to event members and au" on public.feedback;
drop policy if exists "Feedback visible on public projects, to members and authors" on public.feedback;
create policy "Feedback visible on public projects, to members and authors"
  on public.feedback
  for select
  to anon, authenticated
  using (
    (project_id is not null and public.is_project_public(project_id))
    or (
      (select auth.uid()) is not null
      and (
        mentor_id = (select auth.uid())
        or (project_id is not null
            and public.user_has_event_role(public.project_event_id(project_id), (select auth.uid())))
        or (project_id is null and event_id is not null
            and public.user_has_event_role(event_id, (select auth.uid())))
      )
    )
  );

-- 10. feedback.event_id follows the project (MENT-001), so it must not block
-- deleting an event: projects.event_id is ON DELETE SET NULL, do the same here
-- (was NO ACTION, which made events with feedback undeletable).
alter table public.feedback drop constraint if exists feedback_event_id_fkey;
alter table public.feedback
  add constraint feedback_event_id_fkey foreign key (event_id)
  references public.events(event_id) on delete set null;
