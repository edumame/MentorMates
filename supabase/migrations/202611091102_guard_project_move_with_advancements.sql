-- A round advancement (finalist status) only counts for the event it was
-- awarded in. 202611080105 refuses to move a project that has scores, prize
-- winners or votes, but not one that has only a round advancement, so a
-- finalist could carry that status into another event.
--
-- This extends guard_project_event_change from 202611080105 (body unchanged
-- otherwise). The advancement check only applies when the project is attached
-- to an event (new.event_id is not null):
--   * delete_event detaches projects through ON DELETE SET NULL while the
--     event's advancements are removed by the same cascade, and that must not
--     be refused;
--   * detaching keeps the advancement rows, so re-attaching the project to any
--     event is still refused and the status cannot be laundered.
-- Idempotent: create or replace.

begin;

create or replace function public.guard_project_event_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if new.event_id is not distinct from old.event_id then
    return new;
  end if;

  if exists (select 1 from public.project_scores s where s.project_id = old.id)
     or exists (select 1 from public.prize_winners w where w.project_id = old.id)
     or exists (select 1 from public.project_votes v where v.project_id = old.id) then
    raise exception 'A project with scores, prizes or votes cannot be moved to another event'
      using errcode = '23514';
  end if;

  if new.event_id is not null
     and exists (
       select 1 from public.project_round_advancements a
       where a.project_id = old.id
         and a.event_id is distinct from new.event_id
     ) then
    raise exception 'A project that has advanced in judging cannot be moved to another event'
      using errcode = '23514';
  end if;

  if v_uid is not null and new.event_id is not null
     and not public.user_has_event_role(new.event_id, v_uid)
     and not public.is_event_organizer_or_owner(new.event_id, v_uid)
     and not public.is_admin_user(v_uid) then
    raise exception 'You can only move a project to an event you have joined'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

commit;
