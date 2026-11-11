-- A1 (audit 2026-11-08): project_scores integrity.
--   JUDGE-001  score rows must belong to the project's own event/track, and every
--              writer (organizers included) can only author rows as themselves.
--   JUDGE-004  score values are validated against the track's rubric server-side.
--   JUDGE-015  judges only read their own score rows; organizers/owners read all.
--   JUDGE-016  judges only write scores for projects assigned to them, that are
--              submitted, in the event's active round (and advanced to it).
-- Idempotent: create or replace / drop policy if exists / create table if not exists.
--
-- PRE-FLIGHT (read-only; run against prod before applying and review the counts):
--   select count(*) as null_event_backfillable
--     from public.project_scores s join public.projects p on p.id = s.project_id
--    where s.event_id is null and p.event_id is not null;
--   select count(*) as cross_event_to_quarantine
--     from public.project_scores s join public.projects p on p.id = s.project_id
--    where s.event_id is not null and (p.event_id is null or s.event_id <> p.event_id);
--   select count(*) as foreign_track_to_quarantine
--     from public.project_scores s join public.event_tracks et on et.track_id = s.track_id
--    where s.event_id is not null and et.event_id <> s.event_id;
--   select count(*) as null_track_legacy_rows from public.project_scores where track_id is null;

begin;

-- ---------------------------------------------------------------------------
-- Data repair FIRST (before the stricter trigger exists):
--   1. backfill NULL event_id from the project (legacy rows, never deleted);
--   2. move rows that still disagree with their project/track into a holding
--      table (audit_quarantine_project_scores) instead of deleting them.
-- ---------------------------------------------------------------------------
drop trigger if exists validate_score_track_id on public.project_scores;

update public.project_scores s
set event_id = p.event_id
from public.projects p
where p.id = s.project_id
  and s.event_id is null
  and p.event_id is not null;

create table if not exists public.audit_quarantine_project_scores (
  like public.project_scores,
  quarantined_at timestamptz not null default now(),
  quarantine_reason text not null
);
alter table public.audit_quarantine_project_scores enable row level security;
revoke all on table public.audit_quarantine_project_scores from public, anon, authenticated;

with moved as (
  delete from public.project_scores s
  using public.projects p
  where p.id = s.project_id
    and s.event_id is not null
    and (p.event_id is null or s.event_id <> p.event_id)
  returning s.*
)
insert into public.audit_quarantine_project_scores
select moved.*, now(), 'event_id does not match project event (202611080101)' from moved;

with moved as (
  delete from public.project_scores s
  using public.event_tracks et
  where et.track_id = s.track_id
    and s.event_id is not null
    and et.event_id <> s.event_id
  returning s.*
)
insert into public.audit_quarantine_project_scores
select moved.*, now(), 'track belongs to another event (202611080101)' from moved;

-- ---------------------------------------------------------------------------
-- Rubric resolution: every criterion that may apply to (track, round).
-- Mirrors the client precedence in lib/judging/scoring-config.ts
-- (getTrackScoringConfigForRound) but returns the union of all sources so a
-- valid client-side resolution is always accepted.
-- ---------------------------------------------------------------------------
create or replace function public.project_score_criteria(p_track_id uuid, p_round integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with t as (
    select et.track_id,
           et.name,
           case when jsonb_typeof(et.scoring_criteria) = 'object' then et.scoring_criteria else '{}'::jsonb end as sc,
           case when jsonb_typeof(e.scoring_config) = 'object' then e.scoring_config else '{}'::jsonb end as cfg
    from public.event_tracks et
    join public.events e on e.event_id = et.event_id
    where et.track_id = p_track_id
  ),
  cfg_tracks as (
    select t.track_id, t.name, x.key, x.value
    from t, jsonb_each(case when jsonb_typeof(t.cfg->'tracks') = 'object' then t.cfg->'tracks' else '{}'::jsonb end) x
  ),
  cfg_rounds as (
    select t.track_id, r.value as round_cfg
    from t, jsonb_array_elements(case when jsonb_typeof(t.cfg->'rounds') = 'array' then t.cfg->'rounds' else '[]'::jsonb end) r
    where r.value->>'round_number' = p_round::text
  ),
  sources as (
    -- event_tracks.scoring_criteria.criteria (base)
    select sc->'criteria' as c from t
    -- event_tracks.scoring_criteria.rounds[round].criteria (per-track round override)
    union all select sc->'rounds'->(p_round::text)->'criteria' from t
    -- events.scoring_config.tracks[track_id|same name].criteria
    union all select value->'criteria' from cfg_tracks where key = track_id::text or value->>'name' = name
    -- events.scoring_config.rounds[round].criteria (round-wide override)
    union all select round_cfg->'criteria' from cfg_rounds
    -- events.scoring_config.rounds[round].tracks[track_id].criteria
    union all select round_cfg->'tracks'->(track_id::text)->'criteria' from cfg_rounds
  )
  select coalesce(jsonb_agg(elem), '[]'::jsonb)
  from sources,
       jsonb_array_elements(case when jsonb_typeof(sources.c) = 'array' then sources.c else '[]'::jsonb end) elem
  where jsonb_typeof(elem) = 'object' and coalesce(elem->>'id', '') <> '';
$$;

revoke all on function public.project_score_criteria(uuid, integer) from public, anon;
grant execute on function public.project_score_criteria(uuid, integer) to authenticated, service_role;

-- Returns null when p_scores is valid for the rubric, otherwise an error message.
-- Numeric criteria: a JSON number within [min, max] (client defaults: min 0, max 10).
-- Multiple-choice criteria: one of the configured options, or "" (unanswered).
create or replace function public.project_score_values_error(p_track_id uuid, p_round integer, p_scores jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_criteria jsonb := public.project_score_criteria(p_track_id, p_round);
  v_key text;
  v_value jsonb;
  v_criterion jsonb;
  v_known boolean;
  v_ok boolean;
  v_lo numeric;
  v_hi numeric;
begin
  if p_scores is null or jsonb_typeof(p_scores) <> 'object' then
    return 'Scores must be an object keyed by criterion id';
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_scores) loop
    v_known := false;
    v_ok := false;
    for v_criterion in select c from jsonb_array_elements(v_criteria) c where c->>'id' = v_key loop
      v_known := true;
      if coalesce(v_criterion->>'type', 'numeric') = 'multiplechoice' then
        if jsonb_typeof(v_value) in ('string', 'number') and (
             (v_value #>> '{}') = ''
             or exists (
               select 1
               from jsonb_array_elements_text(
                 case when jsonb_typeof(v_criterion->'options') = 'array' then v_criterion->'options' else '[]'::jsonb end
               ) o
               where o = (v_value #>> '{}')
             )
           ) then
          v_ok := true;
        end if;
      else
        if jsonb_typeof(v_value) = 'number' then
          v_lo := case when jsonb_typeof(v_criterion->'min') = 'number' then (v_criterion->>'min')::numeric else 0 end;
          -- normalizeCriterion() treats a missing/0 max as 10.
          v_hi := case when jsonb_typeof(v_criterion->'max') = 'number' and (v_criterion->>'max')::numeric <> 0
                       then (v_criterion->>'max')::numeric else 10 end;
          if (v_value #>> '{}')::numeric between v_lo and v_hi then
            v_ok := true;
          end if;
        end if;
      end if;
      exit when v_ok;
    end loop;

    if not v_known then
      return format('Unknown scoring criterion "%s" for this track', v_key);
    end if;
    if not v_ok then
      return format('Invalid value for scoring criterion "%s"', v_key);
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function public.project_score_values_error(uuid, integer, jsonb) from public, anon;
grant execute on function public.project_score_values_error(uuid, integer, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row invariants (apply to every writer, including the service role).
-- Replaces the old body of validate_score_track_id (same trigger name).
-- ---------------------------------------------------------------------------
create or replace function public.validate_score_track_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_event uuid;
  v_error text;
begin
  select p.event_id into v_project_event from public.projects p where p.id = new.project_id;

  if new.event_id is null or v_project_event is null or new.event_id <> v_project_event then
    raise exception 'Score event does not match the project''s event' using errcode = '23514';
  end if;

  if new.track_id is null or not exists (
    select 1 from public.event_tracks et where et.track_id = new.track_id and et.event_id = new.event_id
  ) then
    raise exception 'Invalid track_id: track does not belong to this event' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.project_tracks pt where pt.project_id = new.project_id and pt.track_id = new.track_id
  ) then
    raise exception 'Invalid track_id: Project does not belong to this track' using errcode = '23514';
  end if;

  if new.round_number is null or new.round_number < 1 then
    raise exception 'Invalid round_number' using errcode = '23514';
  end if;

  if tg_op = 'INSERT'
     or new.scores is distinct from old.scores
     or new.track_id is distinct from old.track_id
     or new.round_number is distinct from old.round_number then
    v_error := public.project_score_values_error(new.track_id, new.round_number, new.scores);
    if v_error is not null then
      raise exception '%', v_error using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_score_track_id on public.project_scores;
create trigger validate_score_track_id
  before insert or update on public.project_scores
  for each row execute function public.validate_score_track_id();

-- ---------------------------------------------------------------------------
-- Authorization for writes (RLS). Organizers/owners may score any project in
-- their event, but only as themselves. Judges need an assignment, a submitted
-- project, the active round and (round > 1) an advancement into that round.
-- ---------------------------------------------------------------------------
create or replace function public.can_write_project_score(
  p_project_id uuid,
  p_event_id uuid,
  p_round integer,
  p_judge_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_config jsonb;
  v_active integer := 1;
begin
  if v_uid is null or p_event_id is null or p_judge_id is distinct from v_uid then
    return false;
  end if;

  if public.is_event_organizer_or_owner(p_event_id, v_uid) then
    return true;
  end if;

  if not public.is_event_judge(p_event_id, v_uid) then
    return false;
  end if;

  if not exists (
    select 1 from public.project_assignments pa
    where pa.project_id = p_project_id and pa.user_id = v_uid
      and pa.event_id = p_event_id and pa.role = 'judge'
  ) then
    return false;
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.event_id = p_event_id and p.submitted is true
  ) then
    return false;
  end if;

  select e.scoring_config into v_config from public.events e where e.event_id = p_event_id;
  if jsonb_typeof(v_config->'activeRound') = 'number' and (v_config->>'activeRound')::numeric >= 1 then
    v_active := floor((v_config->>'activeRound')::numeric)::integer;
  end if;
  if p_round is distinct from v_active then
    return false;
  end if;

  -- Same eligibility rule as lib/judging/rounds.ts getProjectIdsForRound.
  return exists (
    select 1 from public.project_round_advancements a
    where a.event_id = p_event_id and a.project_id = p_project_id and a.round_number = p_round
  ) or (
    p_round = 1 and not exists (
      select 1 from public.project_round_advancements a
      where a.event_id = p_event_id and a.round_number = 1
    )
  );
end;
$$;

revoke all on function public.can_write_project_score(uuid, uuid, integer, uuid) from public, anon;
grant execute on function public.can_write_project_score(uuid, uuid, integer, uuid) to authenticated, service_role;

alter table public.project_scores enable row level security;

drop policy if exists "Judges and organizers can view project scores for their events" on public.project_scores;
drop policy if exists "Judges can submit scores and organizers can submit any score fo" on public.project_scores;
drop policy if exists "Judges can submit scores and organizers can submit any score for their events" on public.project_scores;
drop policy if exists "Judges can edit their own scores and organizers can edit any sc" on public.project_scores;
drop policy if exists "Judges can edit their own scores and organizers can edit any score for their events" on public.project_scores;
drop policy if exists "Judges can delete their own scores and organizers can delete an" on public.project_scores;
drop policy if exists "Judges can delete their own scores and organizers can delete any score for their events" on public.project_scores;
drop policy if exists "project_scores_select_own_or_organizer" on public.project_scores;
drop policy if exists "project_scores_insert_authorized" on public.project_scores;
drop policy if exists "project_scores_update_own" on public.project_scores;
drop policy if exists "project_scores_delete_own_or_organizer" on public.project_scores;

create policy "project_scores_select_own_or_organizer"
  on public.project_scores for select to authenticated
  using (
    event_id is not null and (
      (judge_id = (select auth.uid()) and public.is_event_judge(event_id, (select auth.uid())))
      or public.is_event_organizer_or_owner(event_id, (select auth.uid()))
    )
  );

create policy "project_scores_insert_authorized"
  on public.project_scores for insert to authenticated
  with check (public.can_write_project_score(project_id, event_id, round_number, judge_id));

create policy "project_scores_update_own"
  on public.project_scores for update to authenticated
  using (
    event_id is not null
    and judge_id = (select auth.uid())
    and (
      public.is_event_judge(event_id, (select auth.uid()))
      or public.is_event_organizer_or_owner(event_id, (select auth.uid()))
    )
  )
  with check (public.can_write_project_score(project_id, event_id, round_number, judge_id));

create policy "project_scores_delete_own_or_organizer"
  on public.project_scores for delete to authenticated
  using (
    event_id is not null and (
      (judge_id = (select auth.uid()) and public.is_event_judge(event_id, (select auth.uid())))
      or public.is_event_organizer_or_owner(event_id, (select auth.uid()))
    )
  );

-- Anonymous callers never touch scores.
revoke all on table public.project_scores from anon;

commit;
