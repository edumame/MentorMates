-- NEW-003 round 2 (lane E): after 0601, a team member listed on a project by
-- email (lead_email / teammates) but without a role in a non-public event
-- could read the project (can_view_project has an is_project_member branch)
-- but saw 0 feedback, because the feedback SELECT policy only checked
-- is_project_public / event roles. Add the same team-member branch.
-- Otherwise identical to the A2 policy of the same name.
--
-- Deploy: see audit-2026-11-08/final/DEPLOY-CHECKLIST.md. Idempotent.

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
        or (project_id is not null and public.user_has_event_role(public.project_event_id(project_id), (select auth.uid())))
        or (project_id is not null and public.is_project_member(project_id, (select auth.uid())))
        or (project_id is null and event_id is not null and public.user_has_event_role(event_id, (select auth.uid())))
      )
    )
  );
