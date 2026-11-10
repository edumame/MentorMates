-- A1 (audit 2026-11-08) JUDGE-017 (scores side): when a user stops being a judge of
-- an event (role row deleted or changed away from 'judge'), drop their judge
-- project_assignments so they no longer appear as assigned. Their existing
-- project_scores are intentionally kept (whether to keep or discard them is an
-- owner decision); with 202611080101 they can no longer read or edit them.
-- Idempotent: create or replace / drop trigger if exists.

begin;

create or replace function public.cleanup_former_judge_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role::text = 'judge' and (
       tg_op = 'DELETE'
       or new.role::text <> 'judge'
       or new.event_id <> old.event_id
       or new.user_id <> old.user_id
     ) then
    delete from public.project_assignments pa
    where pa.user_id = old.user_id
      and pa.event_id = old.event_id
      and pa.role = 'judge';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.cleanup_former_judge_assignments() from public, anon, authenticated;

drop trigger if exists cleanup_former_judge_assignments on public.user_event_roles;
create trigger cleanup_former_judge_assignments
  after delete or update of role, event_id, user_id on public.user_event_roles
  for each row execute function public.cleanup_former_judge_assignments();

commit;
