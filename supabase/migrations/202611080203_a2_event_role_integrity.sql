-- A2 / ORG-002, ORG-003, ORG-017, EVT-ORG-001: event role integrity.
--
-- ORG-002: any organizer could update/delete any user_event_roles row of the
--   event (demote or remove the primary organizer, mint new organizers) and
--   rewrite events.owner_id / publish an unapproved event via PostgREST.
-- EVT-ORG-001: the last organizer could leave (or be demoted), orphaning the event.
-- ORG-003: any signed-in user could read every event's roster.
-- ORG-017: self-service approval requests could ask for requested_role
--   'organizer' and approving one granted organizer.

-- Helpers ------------------------------------------------------------------

create or replace function public.event_owner_id(p_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select owner_id from public.events where event_id = p_event_id;
$$;

revoke all on function public.event_owner_id(uuid) from public;
grant execute on function public.event_owner_id(uuid) to authenticated, service_role;

-- user_event_roles policies -------------------------------------------------

-- Organizers manage non-staff-admin roles of other members. Granting or
-- changing the organizer/admin role, and touching the owner's row, is reserved
-- for administrators and server code (service role) that has verified an
-- invitation. Organizers are invited through the token flow
-- (app/api/events/[eventId]/accept-invite), which uses the service role.
drop policy if exists "Organizers and admins can assign roles to events" on public.user_event_roles;
create policy "Organizers and admins can assign roles to events"
  on public.user_event_roles
  for insert
  to authenticated
  with check (
    public.is_admin_user((select auth.uid()))
    or (
      public.is_event_organizer(event_id, (select auth.uid()))
      and role not in ('organizer', 'admin')
    )
  );

drop policy if exists "Organizers and admins can update roles" on public.user_event_roles;
create policy "Organizers and admins can update roles"
  on public.user_event_roles
  for update
  to authenticated
  using (
    public.is_admin_user((select auth.uid()))
    or (
      public.is_event_organizer(event_id, (select auth.uid()))
      and role not in ('organizer', 'admin')
      and user_id <> (select auth.uid())
      and user_id is distinct from public.event_owner_id(event_id)
    )
  )
  with check (
    public.is_admin_user((select auth.uid()))
    or (
      public.is_event_organizer(event_id, (select auth.uid()))
      and role not in ('organizer', 'admin')
      and user_id <> (select auth.uid())
      and user_id is distinct from public.event_owner_id(event_id)
    )
  );

drop policy if exists "Users, organizers, and admins can remove roles" on public.user_event_roles;
create policy "Users, organizers, and admins can remove roles"
  on public.user_event_roles
  for delete
  to authenticated
  using (
    -- Anyone may leave an event; the last-organizer trigger below stops an
    -- event from being orphaned.
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
    or (
      public.is_event_organizer(event_id, (select auth.uid()))
      and role not in ('organizer', 'admin')
      and user_id is distinct from public.event_owner_id(event_id)
    )
  );

drop policy if exists "Anonymous users can view roles for public events, authenticated" on public.user_event_roles;
drop policy if exists "Event rosters are visible to members and for public events" on public.user_event_roles;
create policy "Event rosters are visible to members and for public events"
  on public.user_event_roles
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.events e
       where e.event_id = user_event_roles.event_id
         and e.visibility = 'public'
    )
    or (
      (select auth.uid()) is not null
      and (
        user_id = (select auth.uid())
        or public.user_has_event_role(event_id, (select auth.uid()))
        or public.event_owner_id(event_id) = (select auth.uid())
        or public.is_admin_user((select auth.uid()))
      )
    )
  );

-- Last organizer guard (EVT-ORG-001) ---------------------------------------
-- Applies to every caller, including the service role, so no API route can
-- orphan an event either. Deleting the event itself (cascade) is allowed.
create or replace function public.prevent_last_organizer_removal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.role <> 'organizer' then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE'
     and new.role = 'organizer'
     and new.event_id = old.event_id then
    return new;
  end if;

  -- Event (or user account) is being deleted: cascades are fine.
  if not exists (select 1 from public.events where event_id = old.event_id)
     or not exists (select 1 from auth.users where id = old.user_id) then
    return coalesce(new, old);
  end if;

  -- Serialize concurrent removals for the same event.
  perform 1 from public.events where event_id = old.event_id for update;

  if not exists (
    select 1 from public.user_event_roles
     where event_id = old.event_id
       and role = 'organizer'
       and user_id <> old.user_id
  ) then
    raise exception 'An event must keep at least one organizer. Add another organizer before leaving or changing this role.'
      using errcode = 'P0001', hint = 'last_organizer';
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.prevent_last_organizer_removal() from public, anon, authenticated;

drop trigger if exists prevent_last_organizer_removal on public.user_event_roles;
create trigger prevent_last_organizer_removal
  before delete or update of role, event_id on public.user_event_roles
  for each row execute function public.prevent_last_organizer_removal();

-- events.owner_id / visibility guard (ORG-002) -----------------------------
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
  before update on public.events
  for each row execute function public.guard_event_ownership_fields();

-- Approval requests (ORG-017) ----------------------------------------------
-- Self-service requests are for the participant role only. Staff roles
-- (mentor, judge, organizer, admin) are granted by invitation.
drop policy if exists "Users can create own requests" on public.participant_approval_requests;
create policy "Users can create own requests"
  on public.participant_approval_requests
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and requested_role = 'participant'
  );

create or replace function public.guard_participant_approval_request()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and coalesce(auth.role(), '') in ('anon', 'authenticated') then
    -- Requests cannot be moved to another event/user or re-targeted.
    new.event_id := old.event_id;
    new.user_id := old.user_id;
    new.requested_role := old.requested_role;
  end if;

  -- Applies to every caller (including the service role): nothing may create
  -- or approve a request for a staff role.
  if new.requested_role <> 'participant'
     and (
       tg_op = 'INSERT'
       or new.requested_role is distinct from old.requested_role
       or (new.status = 'approved' and old.status is distinct from 'approved')
     ) then
    raise exception 'Approval requests can only be made for the participant role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_participant_approval_request on public.participant_approval_requests;
create trigger guard_participant_approval_request
  before insert or update on public.participant_approval_requests
  for each row execute function public.guard_participant_approval_request();
