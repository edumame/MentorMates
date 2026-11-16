-- Atomic project_tracks writes for the API (PR: project tracks behind API).
--
-- Every track change used to run "delete all of a project's tracks, then
-- insert the new set" as two separate PostgREST calls from the browser. When
-- the insert failed, the project was left with no tracks. All writes now go
-- through server routes (app/api/projects/[projectId]/tracks and
-- app/api/events/[eventId]/project-tracks), which call this function with the
-- service role after checking the caller's rights.
--
-- set_project_tracks(p_assignments, p_replace)
--   p_assignments: [{"project_id": "<uuid>", "track_ids": ["<uuid>", ...]}, ...]
--   p_replace = true  -> each listed project ends with exactly its track_ids
--                        (only removed rows are deleted, unchanged rows stay)
--   p_replace = false -> track_ids are added; existing tracks are kept
--   Returns the number of rows added and removed.
--
-- It is one statement, so it either applies completely or not at all. The
-- existing enforce_project_track_same_event trigger still rejects a track
-- from another event (23514) and rolls the whole call back.
--
-- SECURITY INVOKER and executable only by service_role: client roles must go
-- through the API, which enforces membership, organizer and deadline rules.
--
-- VERIFY after applying (read-only):
--   select has_function_privilege('authenticated', 'public.set_project_tracks(jsonb, boolean)', 'execute') as authenticated_can_call,  -- expect false
--          has_function_privilege('anon', 'public.set_project_tracks(jsonb, boolean)', 'execute') as anon_can_call,                    -- expect false
--          has_function_privilege('service_role', 'public.set_project_tracks(jsonb, boolean)', 'execute') as service_can_call;         -- expect true
--
-- Idempotent.

create or replace function public.set_project_tracks(p_assignments jsonb, p_replace boolean)
returns table (added integer, removed integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_added integer := 0;
  v_removed integer := 0;
begin
  if p_assignments is null or jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'p_assignments must be a JSON array' using errcode = '22023';
  end if;
  if p_replace is null then
    raise exception 'p_replace is required' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_assignments) a
    where jsonb_typeof(a) <> 'object'
       or a->>'project_id' is null
       or jsonb_typeof(coalesce(a->'track_ids', '[]'::jsonb)) <> 'array'
  ) then
    raise exception 'each assignment needs a project_id and a track_ids array' using errcode = '22023';
  end if;

  with listed as (
    select distinct (a->>'project_id')::uuid as project_id
    from jsonb_array_elements(p_assignments) a
  ),
  wanted as (
    select distinct (a->>'project_id')::uuid as project_id, t::uuid as track_id
    from jsonb_array_elements(p_assignments) a
    cross join lateral jsonb_array_elements_text(coalesce(a->'track_ids', '[]'::jsonb)) t
  ),
  -- Delete and insert touch disjoint rows (unwanted vs wanted), so running
  -- them in one statement is safe.
  removed_rows as (
    delete from public.project_tracks pt
    using listed l
    where p_replace
      and pt.project_id = l.project_id
      and not exists (
        select 1 from wanted w
        where w.project_id = pt.project_id and w.track_id = pt.track_id
      )
    returning 1
  ),
  added_rows as (
    insert into public.project_tracks (project_id, track_id)
    select project_id, track_id from wanted
    on conflict (project_id, track_id) do nothing
    returning 1
  )
  select (select count(*) from added_rows), (select count(*) from removed_rows)
    into v_added, v_removed;

  return query select v_added, v_removed;
end;
$$;

revoke all on function public.set_project_tracks(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.set_project_tracks(jsonb, boolean) to service_role;
