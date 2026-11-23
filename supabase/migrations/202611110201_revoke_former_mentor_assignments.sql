-- Audit 066: mentor project_assignments outlive the mentor role.
--
-- 202611080105 soft-revokes a judge's project_assignments (revoked_at) when
-- their judge role is removed or changed, and restores them when they become
-- a judge again. Mentor assignments had no such cleanup, so a removed or
-- demoted mentor stayed under Assigned Mentors and counted toward coverage.
--
-- This replaces cleanup_former_judge_assignments with one function that
-- applies the same rule to both assignable roles ('judge', 'mentor'):
--   * revoke: when a user_event_roles row with role R is deleted, or changed
--     to another role / user / event, that user's active R assignments in the
--     old event get revoked_at = now(). Rows are kept, never deleted.
--   * restore: when a row with role R is inserted or updated, that user's
--     revoked R assignments in that event get revoked_at = null.
-- Judge behaviour is unchanged. All reads of project_assignments already
-- filter revoked_at is null (project-assignments route, judge dashboard,
-- public project page, can_write_project_score, auto_assign_event_roles).
--
-- Backfill: active mentor assignments whose user is not a mentor of that event
-- are soft-revoked. Organizers and admins are exempt because
-- auto_assign_event_roles(p_include_organizers => true) assigns organizers as
-- mentors on purpose. The backfill is reversible: revoked rows are restored
-- automatically if the user becomes a mentor of the event again.
-- Idempotent: create or replace / drop ... if exists / revoked_at is null.

begin;

create or replace function public.sync_role_project_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Revoke on removal or demotion (assignments and scores are kept).
  if tg_op in ('UPDATE', 'DELETE') and old.role::text in ('judge', 'mentor') and (
       tg_op = 'DELETE'
       or new.role <> old.role
       or new.event_id <> old.event_id
       or new.user_id <> old.user_id
     ) then
    update public.project_assignments pa
    set revoked_at = now()
    where pa.user_id = old.user_id
      and pa.event_id = old.event_id
      and pa.role = old.role
      and pa.revoked_at is null;
  end if;

  -- Restore on (re-)promotion.
  if tg_op in ('INSERT', 'UPDATE') and new.role::text in ('judge', 'mentor') then
    update public.project_assignments pa
    set revoked_at = null
    where pa.user_id = new.user_id
      and pa.event_id = new.event_id
      and pa.role = new.role
      and pa.revoked_at is not null;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_role_project_assignments() from public, anon, authenticated;

drop trigger if exists cleanup_former_judge_assignments on public.user_event_roles;
drop trigger if exists sync_role_project_assignments on public.user_event_roles;
create trigger sync_role_project_assignments
  after insert or delete or update of role, event_id, user_id on public.user_event_roles
  for each row execute function public.sync_role_project_assignments();

drop function if exists public.cleanup_former_judge_assignments();

-- One-time backfill of mentor assignments left behind before this migration.
do $$
declare
  v_revoked integer;
begin
  update public.project_assignments pa
  set revoked_at = now()
  where pa.role = 'mentor'
    and pa.revoked_at is null
    and not exists (
      select 1 from public.user_event_roles r
      where r.user_id = pa.user_id
        and r.event_id = pa.event_id
        and r.role::text in ('mentor', 'organizer', 'admin')
    );
  get diagnostics v_revoked = row_count;
  raise notice 'revoke_former_mentor_assignments: soft-revoked % stale mentor assignment(s)', v_revoked;
end;
$$;

commit;
