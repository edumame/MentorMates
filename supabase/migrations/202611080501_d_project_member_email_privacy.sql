-- PUB-008 / JUDGE-012: anonymous visitors could read lead_email and teammates
-- (member email addresses) of every non-private project straight from
-- PostgREST. The app's public API now returns an email-free team roster
-- (app/api/projects/route.ts + lib/projects/team-members.ts), so anon only
-- needs the non-identifying columns.
--
-- Column privileges are additive to RLS: rows are still filtered by the
-- existing SELECT policy. NOTE: a column added to public.projects later is
-- not readable by anon until it is added to the grant below.

revoke select on table public.projects from anon;

grant select (
  id,
  lead_name,
  project_description,
  created_at,
  project_name,
  project_url,
  additional_materials_url,
  event_id,
  cover_image_url,
  video_url,
  submitted,
  submitted_at,
  contextus_project_id,
  private
) on table public.projects to anon;
