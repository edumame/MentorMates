-- A1 (audit 2026-11-08) JUDGE-013: a prize can only be awarded to a project of the
-- prize's own event, only by an organizer of that event, and the prize's organizer
-- can always remove a winner from their prize. assigned_by records the actor.
-- Idempotent: create or replace / drop policy if exists / create table if not exists.
--
-- PRE-FLIGHT (read-only; run against prod before applying and review the count):
--   select count(*) as cross_event_winners_to_quarantine
--     from public.prize_winners w
--     join public.prizes pr on pr.id = w.prize_id
--     join public.event_tracks et on et.track_id = pr.track_id
--     join public.projects p on p.id = w.project_id
--    where p.event_id is null or p.event_id <> et.event_id;

begin;

-- Data repair FIRST: move existing cross-event (forged) winners into a holding
-- table instead of deleting them.
create table if not exists public.audit_quarantine_prize_winners (
  like public.prize_winners,
  quarantined_at timestamptz not null default now(),
  quarantine_reason text not null
);
alter table public.audit_quarantine_prize_winners enable row level security;
revoke all on table public.audit_quarantine_prize_winners from public, anon, authenticated;

with moved as (
  delete from public.prize_winners w
  using public.prizes pr, public.event_tracks et, public.projects p
  where pr.id = w.prize_id
    and et.track_id = pr.track_id
    and p.id = w.project_id
    and (p.event_id is null or p.event_id <> et.event_id)
  returning w.*
)
insert into public.audit_quarantine_prize_winners
select moved.*, now(), 'prize and project in different events (202611080102)' from moved;

create or replace function public.prize_event_id(p_prize_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select et.event_id
  from public.prizes pr
  join public.event_tracks et on et.track_id = pr.track_id
  where pr.id = p_prize_id;
$$;

revoke all on function public.prize_event_id(uuid) from public, anon;
grant execute on function public.prize_event_id(uuid) to authenticated, service_role;

-- Invariant for every writer (service role included): prize event = project event.
create or replace function public.enforce_prize_winner_same_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prize_event uuid;
  v_project_event uuid;
begin
  if new.prize_id is null or new.project_id is null then
    raise exception 'prize_id and project_id are required' using errcode = '23502';
  end if;

  v_prize_event := public.prize_event_id(new.prize_id);
  select p.event_id into v_project_event from public.projects p where p.id = new.project_id;

  if v_prize_event is null or v_project_event is null or v_prize_event <> v_project_event then
    raise exception 'Prize and project must belong to the same event' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and new.assigned_by is null and auth.uid() is not null then
    new.assigned_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_prize_winner_same_event on public.prize_winners;
create trigger enforce_prize_winner_same_event
  before insert or update on public.prize_winners
  for each row execute function public.enforce_prize_winner_same_event();

alter table public.prize_winners enable row level security;

drop policy if exists "Event organizers can assign prizes to projects from their event" on public.prize_winners;
drop policy if exists "Event organizers can update prize assignments for projects from" on public.prize_winners;
drop policy if exists "Event organizers can update prize assignments for projects from their event" on public.prize_winners;
drop policy if exists "Event organizers can remove prize assignments for projects from" on public.prize_winners;
drop policy if exists "Event organizers can remove prize assignments for projects from their event" on public.prize_winners;
drop policy if exists "prize_winners_insert_same_event_organizer" on public.prize_winners;
drop policy if exists "prize_winners_update_same_event_organizer" on public.prize_winners;
drop policy if exists "prize_winners_delete_prize_or_project_organizer" on public.prize_winners;

create policy "prize_winners_insert_same_event_organizer"
  on public.prize_winners for insert to authenticated
  with check (
    prize_id is not null and project_id is not null
    and public.is_track_event_organizer(
      (select pr.track_id from public.prizes pr where pr.id = prize_winners.prize_id),
      (select auth.uid())
    )
    and public.is_project_event_organizer(project_id, (select auth.uid()))
    and (assigned_by is null or assigned_by = (select auth.uid()))
  );

create policy "prize_winners_update_same_event_organizer"
  on public.prize_winners for update to authenticated
  using (
    prize_id is not null
    and public.is_track_event_organizer(
      (select pr.track_id from public.prizes pr where pr.id = prize_winners.prize_id),
      (select auth.uid())
    )
  )
  with check (
    prize_id is not null and project_id is not null
    and public.is_track_event_organizer(
      (select pr.track_id from public.prizes pr where pr.id = prize_winners.prize_id),
      (select auth.uid())
    )
    and public.is_project_event_organizer(project_id, (select auth.uid()))
    and (assigned_by is null or assigned_by = (select auth.uid()))
  );

-- Either side's organizer may remove a winner (so a legacy foreign row can be cleaned
-- up by the prize's organizer).
create policy "prize_winners_delete_prize_or_project_organizer"
  on public.prize_winners for delete to authenticated
  using (
    (prize_id is not null and public.is_track_event_organizer(
      (select pr.track_id from public.prizes pr where pr.id = prize_winners.prize_id),
      (select auth.uid())
    ))
    or (project_id is not null and public.is_project_event_organizer(project_id, (select auth.uid())))
  );

-- Anonymous callers may read winners (public certificates) but never write.
revoke insert, update, delete, truncate on table public.prize_winners from anon;

commit;
