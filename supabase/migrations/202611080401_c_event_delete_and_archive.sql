-- Lane C (audit 2026-11-08): ORG-006, ORG-004, ORG-005
--
-- ORG-006: Deleting an event used to be ~8 sequential client-side deletes with
-- the user-scoped client. RLS hid some rows (feedback), several FKs to events
-- are ON DELETE NO ACTION, so the final DELETE failed after tracks, prizes and
-- the organizer's own role had already been removed. public.delete_event()
-- performs the whole delete in one transaction after checking permission.
--
-- ORG-004: Organizers could not archive their event because the updated row
-- (visibility = 'archived') no longer satisfied any SELECT policy.
--
-- ORG-005: Archived events are documented as read-only for organizers; enforce
-- it at the data layer (only the visibility change itself is allowed).

-- ---------------------------------------------------------------------------
-- Shared permission helper: event owner, event organizer/admin role, or
-- global admin.
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_event(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and (
    exists (
      select 1 from public.events e
      where e.event_id = p_event_id and e.owner_id = p_user_id
    )
    or exists (
      select 1 from public.user_event_roles r
      where r.event_id = p_event_id
        and r.user_id = p_user_id
        and r.role in ('organizer', 'admin')
    )
    or coalesce(public.is_admin_user(p_user_id), false)
  );
$$;

revoke all on function public.can_manage_event(uuid, uuid) from public;
grant execute on function public.can_manage_event(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- ORG-006: atomic event delete
-- Errors use distinct SQLSTATEs so the API can map them to HTTP codes without
-- leaking raw Postgres messages:
--   28000 not authenticated, 42501 forbidden, P0002 not found,
--   P0001 with message 'event_has_payments' -> 409 (archive instead).
-- ---------------------------------------------------------------------------
create or replace function public.delete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Lock the row so concurrent deletes/updates serialize.
  perform 1 from public.events where event_id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_event(p_event_id, v_uid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Financial records must survive: user_event_payments cascades on event
  -- delete, so refuse to delete events that have taken (or refunded) money.
  -- Organizers should archive these events instead.
  if exists (
    select 1 from public.user_event_payments p
    where p.event_id = p_event_id
      and p.payment_status in ('paid', 'refunded')
  ) then
    raise exception 'event_has_payments' using errcode = 'P0001';
  end if;

  -- Tables whose FK to events is ON DELETE NO ACTION. Deleting tracks cascades
  -- to prizes (-> prize_winners), project_scores and project_tracks; deleting
  -- feedback cascades to feedback_read_status.
  delete from public.feedback where event_id = p_event_id;
  delete from public.platform_engagement where event_id = p_event_id;
  delete from public.event_tracks where event_id = p_event_id;

  -- Everything else cascades (roles, tickets, forms, teams, ...) or is
  -- SET NULL (projects keep existing for their owners).
  delete from public.events where event_id = p_event_id;
end;
$$;

revoke all on function public.delete_event(uuid) from public;
grant execute on function public.delete_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ORG-004: managers can still see their archived events (required both to read
-- the archived event in the console and for the UPDATE to archived to pass).
-- Separate permissive policy so the main SELECT policy stays untouched.
-- ---------------------------------------------------------------------------
drop policy if exists "Event managers can view archived events" on public.events;
create policy "Event managers can view archived events"
  on public.events
  for select
  to authenticated
  using (
    visibility = 'archived'
    and public.can_manage_event(event_id, (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- ORG-005: archived events are read-only for non-admin users; the only change
-- allowed is the visibility itself (i.e. unarchiving). Service-role writes
-- (auth.uid() is null) are not affected.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_archived_event_read_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if old.visibility = 'archived'
     and v_uid is not null
     and not coalesce(public.is_admin_user(v_uid), false)
     and (to_jsonb(new) - 'visibility' - 'updated_at')
         is distinct from (to_jsonb(old) - 'visibility' - 'updated_at')
  then
    raise exception 'archived events are read-only; unarchive first'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists zz_events_archived_read_only on public.events;
create trigger zz_events_archived_read_only
  before update on public.events
  for each row
  execute function public.enforce_archived_event_read_only();
