-- A2 / MENT-001, MENT-002: feedback authorship integrity and mentor email exposure.
--
-- MENT-001: the INSERT policy accepted any mentor_id, so anyone could post
-- feedback attributed to a real mentor, and its "event_id IS NULL" branch let
-- any signed-in user write into any project (including private projects of
-- events they never joined). The UPDATE policy let a mentor move their row to
-- any project.
-- MENT-002: feedback.mentor_email was readable by anonymous visitors on public
-- projects. The address is derivable from mentor_id for callers allowed to see
-- it (user_profiles RLS), so it is no longer stored.

-- Event of a project, readable from policies regardless of project RLS.
create or replace function public.project_event_id(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select event_id from public.projects where id = p_project_id;
$$;

revoke all on function public.project_event_id(uuid) from public;
grant execute on function public.project_event_id(uuid) to anon, authenticated, service_role;

-- Server-derived columns for writes made with a user JWT.
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

  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Authors may edit the text of their feedback, never move or re-attribute it.
    new.project_id := old.project_id;
    new.event_id := old.event_id;
    new.mentor_id := old.mentor_id;
    new.mentor_name := old.mentor_name;
    new.created_at := old.created_at;
  else
    -- The event always follows the project; clients cannot pick it.
    new.event_id := public.project_event_id(new.project_id);
    if new.mentor_id is not null then
      select display_name into v_display_name
        from public.user_profiles where uid = new.mentor_id;
      new.mentor_name := coalesce(nullif(btrim(v_display_name), ''), new.mentor_name);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_feedback_integrity() from public, anon, authenticated;

drop trigger if exists enforce_feedback_integrity on public.feedback;
create trigger enforce_feedback_integrity
  before insert or update on public.feedback
  for each row execute function public.enforce_feedback_integrity();

drop policy if exists "Event participants can submit feedback for projects in their ev" on public.feedback;
drop policy if exists "Feedback authors can submit for visible projects" on public.feedback;
create policy "Feedback authors can submit for visible projects"
  on public.feedback
  for insert
  to anon, authenticated
  with check (
    project_id is not null
    and (
      -- Anonymous feedback (signed out, or signed in but unattributed) only on public projects.
      (mentor_id is null and public.is_project_public(project_id))
      or (
        (select auth.uid()) is not null
        and mentor_id = (select auth.uid())
        and (
          public.is_project_public(project_id)
          or public.user_has_event_role(public.project_event_id(project_id), (select auth.uid()))
        )
      )
    )
  );

drop policy if exists "Mentors can edit their own feedback" on public.feedback;
create policy "Mentors can edit their own feedback"
  on public.feedback
  for update
  to authenticated
  using (mentor_id = (select auth.uid()))
  with check (mentor_id = (select auth.uid()));

-- Remove stored mentor emails (MENT-002). Callers that need the address
-- resolve mentor_id through user_profiles, whose RLS limits who can read it.
-- PROD PRE-CHECK (read-only):
--   select count(*) filter (where mentor_id is not null) as derivable,
--          count(*) filter (where mentor_id is null) as not_derivable
--     from public.feedback where mentor_email is not null;
-- Every cleared value is copied to a service-only quarantine table first
-- (including rows with mentor_id IS NULL, whose address cannot be re-derived).
create schema if not exists audit_backup;
revoke all on schema audit_backup from public, anon, authenticated;

create table if not exists audit_backup.feedback_mentor_email_20261108 (
  feedback_id uuid primary key,
  mentor_id uuid,
  mentor_email text,
  captured_at timestamptz not null default now()
);
revoke all on audit_backup.feedback_mentor_email_20261108 from public, anon, authenticated;

insert into audit_backup.feedback_mentor_email_20261108 (feedback_id, mentor_id, mentor_email)
select id, mentor_id, mentor_email from public.feedback where mentor_email is not null
on conflict (feedback_id) do nothing;

do $$
declare v_count integer;
begin
  select count(*) into v_count from public.feedback where mentor_email is not null;
  raise notice 'A2 MENT-002: clearing % feedback.mentor_email value(s) (backed up in audit_backup.feedback_mentor_email_20261108)', v_count;
end $$;

update public.feedback set mentor_email = null where mentor_email is not null;
