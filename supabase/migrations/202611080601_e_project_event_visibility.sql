-- NEW-003 (lane E): non-private projects of non-public events were readable by
-- anyone through PostgREST, because every project read rule treated
-- projects.private = false as "world readable" and ignored the event.
--
-- New rule (same as canViewEventProjects() in app/api/projects/route.ts):
-- a non-private project is readable when it has no event, its event is
-- public, or the caller belongs to / manages the event (or is on the team).
-- Private projects keep their existing rule (team members and event members),
-- plus event managers.
--
-- The helpers are redefined in place, so every policy that already uses them
-- picks up the rule: projects, project_tracks, project_artifacts,
-- project_submission_answers, project_field_entries and feedback.
--
-- Deploy: see audit-2026-11-08/final/DEPLOY-CHECKLIST.md. Idempotent.

create or replace function public.can_view_event_projects(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_event_id is not null and (
    exists (
      select 1 from public.events e
      where e.event_id = p_event_id and e.visibility = 'public'
    )
    or (
      p_user_id is not null
      and (
        public.user_has_event_role(p_event_id, p_user_id)
        or public.can_manage_event(p_event_id, p_user_id)
      )
    )
  );
$$;

revoke all on function public.can_view_event_projects(uuid, uuid) from public;
grant execute on function public.can_view_event_projects(uuid, uuid) to anon, authenticated, service_role;

-- "Visible to everyone": not private and not inside a non-public event.
-- Used by the anonymous branches of project_tracks and feedback policies.
create or replace function public.is_project_public(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    left join public.events e on e.event_id = p.event_id
    where p.id = p_project_id
      and coalesce(p.private, true) = false
      and (p.event_id is null or e.visibility = 'public')
  );
$$;

create or replace function public.can_view_project(p_project_id uuid, p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  project_event_id uuid;
  project_is_private boolean;
begin
  select event_id, coalesce(private, false)
    into project_event_id, project_is_private
  from public.projects
  where id = p_project_id;

  if not found then
    return false;
  end if;

  if not project_is_private then
    return project_event_id is null
      or public.can_view_event_projects(project_event_id, p_user_id)
      or (p_user_id is not null and public.is_project_member(p_project_id, p_user_id));
  end if;

  if p_user_id is null then
    return false;
  end if;

  if public.is_project_member(p_project_id, p_user_id) then
    return true;
  end if;

  if project_event_id is not null then
    return public.user_has_event_role(project_event_id, p_user_id)
      or public.can_manage_event(project_event_id, p_user_id);
  end if;

  return false;
end;
$$;

-- projects SELECT: fast path on the row's own columns for public events,
-- otherwise the full helper.
drop policy if exists "anyone can view public projects or authorized users can view pr" on public.projects;
drop policy if exists "Projects are readable when their event is visible" on public.projects;
create policy "Projects are readable when their event is visible"
  on public.projects
  for select
  using (
    (
      coalesce(private, false) = false
      and (event_id is null or public.can_view_event_projects(event_id, (select auth.uid())))
    )
    or public.can_view_project(id, (select auth.uid()))
  );
