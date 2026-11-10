-- Lane C round 2 (audit 2026-11-08): critic follow-ups for ORG-006, ORG-004,
-- ORG-005, ORG-010, ORG-022, JUDGE-008.
--
-- Convention: "end-user request" = current_user in ('authenticated', 'anon')
-- (same as lane A2's guards). Service-role calls and SECURITY DEFINER
-- functions (current_user = owner) are trusted callers. Trigger functions that
-- rely on it are SECURITY INVOKER so current_user is the caller's role.

create or replace function public.is_end_user_request()
returns boolean
language sql
stable
as $$
  select current_user in ('authenticated', 'anon');
$$;

-- ---------------------------------------------------------------------------
-- ORG-004 / ORG-006: one permission definition, identical to the events
-- UPDATE RLS policy (owner, event organizer, global admin).
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_event(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and p_event_id is not null and (
    exists (
      select 1 from public.events e
      where e.event_id = p_event_id and e.owner_id = p_user_id
    )
    or public.is_event_organizer(p_event_id, p_user_id)
    or coalesce(public.is_admin_user(p_user_id), false)
  );
$$;

revoke all on function public.can_manage_event(uuid, uuid) from public, anon;
grant execute on function public.can_manage_event(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- ORG-006: payment guard on EVERY delete path (PostgREST, admin route,
-- service role, delete_event). paid/refunded are financial records; a
-- 'processing' row is a live checkout whose webhook still needs the row.
-- ---------------------------------------------------------------------------
create or replace function public.guard_event_delete_with_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.user_event_payments p
    where p.event_id = old.event_id
      and p.payment_status in ('paid', 'refunded', 'processing')
  ) then
    raise exception 'event_has_payments' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists guard_event_delete_with_payments on public.events;
create trigger guard_event_delete_with_payments
  before delete on public.events
  for each row
  execute function public.guard_event_delete_with_payments();

-- Clients delete events only through public.delete_event().
drop policy if exists "Event owners, organizers, and admins can delete their events" on public.events;

-- ---------------------------------------------------------------------------
-- ORG-006: atomic delete, now also clearing everything A1's
-- guard_project_event_change checks (scores, prize winners, votes) before the
-- projects are detached by projects_event_id_fkey (ON DELETE SET NULL), and
-- rows that reference the event without a FK (would otherwise be orphaned).
-- ---------------------------------------------------------------------------
create or replace function public.delete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_project_ids uuid[];
begin
  -- Inside this SECURITY DEFINER function current_user is the owner, so the
  -- caller is identified by its JWT: the service role (admin route) has no
  -- uid; every other caller must be a signed-in manager of the event.
  if v_uid is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform 1 from public.events where event_id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if v_uid is not null and not public.can_manage_event(p_event_id, v_uid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Checked again by guard_event_delete_with_payments; failing early keeps the
  -- error message stable.
  if exists (
    select 1 from public.user_event_payments p
    where p.event_id = p_event_id
      and p.payment_status in ('paid', 'refunded', 'processing')
  ) then
    raise exception 'event_has_payments' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id), '{}') into v_project_ids
  from public.projects where event_id = p_event_id;

  -- Judging data of the event's projects goes with the event.
  delete from public.project_vote_voids
    where event_id = p_event_id or project_id = any (v_project_ids);
  delete from public.project_votes
    where event_id = p_event_id or project_id = any (v_project_ids);
  delete from public.prize_winners where project_id = any (v_project_ids);
  delete from public.project_scores
    where event_id = p_event_id or project_id = any (v_project_ids);
  delete from public.audit_quarantine_project_scores
    where event_id = p_event_id or project_id = any (v_project_ids);

  -- NO ACTION FKs to events.
  delete from public.feedback where event_id = p_event_id;
  delete from public.platform_engagement where event_id = p_event_id;
  delete from public.event_tracks where event_id = p_event_id;

  -- event_id columns without a FK.
  delete from public.meetings where event_id = p_event_id;
  delete from public.agent_events where event_id = p_event_id;
  delete from public.agents where event_id = p_event_id;

  delete from public.events where event_id = p_event_id;
end;
$$;

revoke all on function public.delete_event(uuid) from public, anon;
grant execute on function public.delete_event(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- ORG-005: archived events are read-only for end users (except global
-- admins), including their configuration tables.
-- ---------------------------------------------------------------------------
create or replace function public.is_event_archived(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events
    where event_id = p_event_id and visibility = 'archived'
  );
$$;

revoke all on function public.is_event_archived(uuid) from public, anon;
grant execute on function public.is_event_archived(uuid) to authenticated, service_role;

create or replace function public.enforce_archived_event_read_only()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.visibility = 'archived'
     and public.is_end_user_request()
     and not coalesce(public.is_admin_user(auth.uid()), false)
     and (to_jsonb(new) - 'visibility' - 'updated_at')
         is distinct from (to_jsonb(old) - 'visibility' - 'updated_at')
  then
    raise exception 'archived events are read-only; unarchive first'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Resolves the owning event of a child-config row regardless of the caller's RLS.
create or replace function public.archived_child_event_id(p_table text, p_row jsonb)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if p_table = 'prizes' then
    select t.event_id into v_event_id
    from public.event_tracks t where t.track_id = (p_row ->> 'track_id')::uuid;
  elsif p_table = 'intake_form_versions' then
    select t.event_id into v_event_id
    from public.intake_form_templates t where t.id = (p_row ->> 'form_template_id')::uuid;
  else
    v_event_id := (p_row ->> 'event_id')::uuid;
  end if;
  return v_event_id;
end;
$$;

revoke all on function public.archived_child_event_id(text, jsonb) from public, anon;
grant execute on function public.archived_child_event_id(text, jsonb) to authenticated, service_role;

create or replace function public.guard_archived_event_child_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if not public.is_end_user_request()
     or coalesce(public.is_admin_user(auth.uid()), false) then
    return coalesce(new, old);
  end if;

  v_event_id := public.archived_child_event_id(tg_table_name, to_jsonb(coalesce(new, old)));

  if v_event_id is not null and public.is_event_archived(v_event_id) then
    raise exception 'archived events are read-only; unarchive first'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'event_tracks', 'prizes', 'pricing_tiers', 'intake_form_templates',
    'intake_form_versions', 'event_intake_form_bindings',
    'event_submission_fields', 'project_round_advancements'
  ] loop
    execute format('drop trigger if exists zz_archived_event_read_only on public.%I', t);
    execute format(
      'create trigger zz_archived_event_read_only before insert or update or delete on public.%I
         for each row execute function public.guard_archived_event_child_write()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- ORG-010: atomic intake submission write (called by the API route with the
-- service role after validation). Submission row and answers are replaced in
-- one transaction, serialized per (event, user, context, project).
-- ---------------------------------------------------------------------------
create or replace function public.submit_intake_form(
  p_event_id uuid,
  p_context public.intake_form_context,
  p_form_version_id uuid,
  p_user_id uuid,
  p_project_id uuid,
  p_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission_id uuid;
begin
  if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' then
    raise exception 'answers must be an object' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'intake:' || p_event_id || ':' || p_user_id || ':' || p_context || ':' ||
      coalesce(p_project_id::text, ''),
      0
    )
  );

  select id into v_submission_id
  from public.intake_form_submissions
  where event_id = p_event_id
    and context = p_context
    and submitter_user_id = p_user_id
    and project_id is not distinct from p_project_id
  for update;

  if v_submission_id is null then
    insert into public.intake_form_submissions
      (event_id, context, form_version_id, submitter_user_id, project_id, status, submitted_at)
    values
      (p_event_id, p_context, p_form_version_id, p_user_id, p_project_id, 'submitted', now())
    returning id into v_submission_id;
  else
    update public.intake_form_submissions
    set form_version_id = p_form_version_id,
        status = 'submitted',
        submitted_at = now(),
        updated_at = now()
    where id = v_submission_id;
  end if;

  delete from public.intake_form_submission_answers where submission_id = v_submission_id;

  insert into public.intake_form_submission_answers
    (submission_id, form_version_id, field_key, value_json)
  select v_submission_id, p_form_version_id, a.key, a.value
  from jsonb_each(coalesce(p_answers, '{}'::jsonb)) as a(key, value);

  return v_submission_id;
end;
$$;

revoke all on function public.submit_intake_form(uuid, public.intake_form_context, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_intake_form(uuid, public.intake_form_context, uuid, uuid, uuid, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- JUDGE-008: auto-assign in one transaction, serialized per event.
-- Pool = users with p_role (plus organizers when requested); projects =
-- submitted projects of the event; round-robin over shuffled lists.
-- Only active (revoked_at is null) assignments of that role are replaced.
-- Errors: 28000 unauthenticated, 42501 forbidden, 22023 invalid input,
-- P0001 'not_enough_roles:<n>'.
-- ---------------------------------------------------------------------------
create or replace function public.auto_assign_event_roles(
  p_event_id uuid,
  p_role public.event_role,
  p_per_project integer,
  p_include_organizers boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pool uuid[];
  v_projects uuid[];
  v_pool_size integer;
  v_inserted integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.can_manage_event(p_event_id, v_uid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('judge', 'mentor') or p_per_project is null or p_per_project < 1 then
    raise exception 'invalid input' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('auto_assign:' || p_event_id || ':' || p_role, 0));

  select coalesce(array_agg(user_id order by random()), '{}') into v_pool
  from (
    select distinct r.user_id
    from public.user_event_roles r
    where r.event_id = p_event_id
      and (r.role = p_role or (p_include_organizers and r.role = 'organizer'))
  ) pool;
  v_pool_size := coalesce(array_length(v_pool, 1), 0);

  if v_pool_size < p_per_project then
    raise exception 'not_enough_roles:%', v_pool_size using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id order by random()), '{}') into v_projects
  from public.projects
  where event_id = p_event_id and submitted = true;

  -- Nothing to assign: keep existing assignments untouched.
  if coalesce(array_length(v_projects, 1), 0) = 0 then
    return jsonb_build_object('assigned', 0, 'projects', 0, 'skipped', true);
  end if;

  delete from public.project_assignments
  where event_id = p_event_id and role = p_role and revoked_at is null;

  insert into public.project_assignments (project_id, user_id, role, event_id, revoked_at)
  select v_projects[p.i],
         v_pool[((p.i - 1) * p_per_project + k.k) % v_pool_size + 1],
         p_role,
         p_event_id,
         null
  from generate_subscripts(v_projects, 1) as p(i)
  cross join generate_series(0, p_per_project - 1) as k(k)
  on conflict (project_id, user_id, role)
  do update set revoked_at = null, event_id = excluded.event_id, updated_at = now();

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'assigned', v_inserted,
    'projects', array_length(v_projects, 1),
    'skipped', false
  );
end;
$$;

revoke all on function public.auto_assign_event_roles(uuid, public.event_role, integer, boolean) from public, anon;
grant execute on function public.auto_assign_event_roles(uuid, public.event_role, integer, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- ORG-022: covers live only under event-covers/<event_id>/; the flat
-- "wizard" path (any signed-in user could host public files) is removed.
-- ---------------------------------------------------------------------------
drop policy if exists "Event managers can upload event covers" on storage.objects;
create policy "Event managers can upload event covers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-materials'
    and public.can_manage_event(public.event_cover_event_id(name), (select auth.uid()))
  );

drop policy if exists "Event managers can update event covers" on storage.objects;
create policy "Event managers can update event covers"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'event-materials'
    and public.can_manage_event(public.event_cover_event_id(name), (select auth.uid()))
  )
  with check (
    bucket_id = 'event-materials'
    and public.can_manage_event(public.event_cover_event_id(name), (select auth.uid()))
  );

drop policy if exists "Event managers can delete event covers" on storage.objects;
create policy "Event managers can delete event covers"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-materials'
    and public.can_manage_event(public.event_cover_event_id(name), (select auth.uid()))
  );

revoke all on function public.event_cover_event_id(text) from public, anon;
grant execute on function public.event_cover_event_id(text) to authenticated, service_role;
