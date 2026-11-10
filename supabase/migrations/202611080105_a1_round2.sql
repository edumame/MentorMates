-- A1 (audit 2026-11-08) round 2, after critic review.
--   1. Parent-side bypass: projects.event_id can only move to an event the caller belongs
--      to, and never once scores / prize winners / votes exist; project_tracks must use a
--      track of the project's own event; prizes cannot be moved to another event's track
--      while they have winners.
--   3. project_scores UPDATE re-checks event/track/project only when those identity
--      columns change, so judges can always edit comments/scores of their own rows
--      (including legacy rows with NULL track_id).
--   4. JUDGE-004: rubric resolved with the SAME precedence as the client
--      (lib/judging/scoring-config.ts getTrackScoringConfigForRound), min default 1 for
--      normalized criteria, numeric strings accepted for values and min/max.
--   5. JUDGE-016: judge round-1 eligibility matches the judge dashboard; organizers limited
--      to configured rounds and submitted projects; judges delete only active-round scores;
--      activeRound must be a positive integer.
--   6. JUDGE-010: self-votes by current team members never count; organizers can void votes
--      (audited).
--   7. JUDGE-017: judge assignments are soft-revoked (revoked_at) on demotion/removal and
--      restored on re-promotion.
--   8. JUDGE-002: is_project_team_member is no longer callable by clients.
--   + JUDGE-011: unknown event in the voting-window check raises P0002 (route maps to 404).
-- Idempotent throughout.
--
-- PRE-FLIGHT (read-only; run against prod before applying):
--   select count(*) as cross_event_project_tracks
--     from public.project_tracks pt join public.projects p on p.id = pt.project_id
--     join public.event_tracks et on et.track_id = pt.track_id
--    where p.event_id is distinct from et.event_id;
--   select count(*) as non_integer_active_round from public.events
--    where scoring_config ? 'activeRound' and jsonb_typeof(scoring_config->'activeRound') <> 'null'
--      and not (jsonb_typeof(scoring_config->'activeRound') = 'number'
--               and (scoring_config->>'activeRound')::numeric >= 1
--               and (scoring_config->>'activeRound')::numeric = floor((scoring_config->>'activeRound')::numeric));
--   select count(*) as self_votes_now_excluded from public.project_votes v
--    where public.is_project_team_member(v.project_id, v.user_id);

begin;

-- ===========================================================================
-- Shared helpers
-- ===========================================================================

-- JSON number or numeric string -> numeric; anything else -> null.
create or replace function public.jsonb_to_numeric_or_null(p_value jsonb)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_value is null then null
    when jsonb_typeof(p_value) = 'number' then (p_value #>> '{}')::numeric
    when jsonb_typeof(p_value) = 'string'
         and btrim(p_value #>> '{}') ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
      then btrim(p_value #>> '{}')::numeric
    else null
  end;
$$;

-- events.scoring_config.activeRound when it is a positive integer, else 1
-- (lib/judging/rounds.ts getActiveRound applies the same rule).
create or replace function public.event_active_round(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when jsonb_typeof(e.scoring_config->'activeRound') = 'number'
           and (e.scoring_config->>'activeRound')::numeric >= 1
           and (e.scoring_config->>'activeRound')::numeric = floor((e.scoring_config->>'activeRound')::numeric)
        then (e.scoring_config->>'activeRound')::integer
      else 1
    end
    from public.events e where e.event_id = p_event_id
  ), 1);
$$;

revoke all on function public.event_active_round(uuid) from public, anon;
grant execute on function public.event_active_round(uuid) to authenticated, service_role;

-- A round number is valid when it is configured in scoring_config.rounds,
-- or it is round 1 and no rounds are configured.
create or replace function public.event_round_is_configured(p_event_id uuid, p_round integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_round is null or p_round < 1 then false
    when jsonb_typeof(e.scoring_config->'rounds') = 'array'
         and jsonb_array_length(e.scoring_config->'rounds') > 0
      then exists (
        select 1 from jsonb_array_elements(e.scoring_config->'rounds') r
        where public.jsonb_to_numeric_or_null(r->'round_number') = p_round
      )
    else p_round = 1
  end
  from public.events e where e.event_id = p_event_id;
$$;

revoke all on function public.event_round_is_configured(uuid, integer) from public, anon;
grant execute on function public.event_round_is_configured(uuid, integer) to authenticated, service_role;

-- activeRound must be a positive integer on every new write (existing rows not re-checked).
alter table public.events drop constraint if exists events_scoring_config_active_round_integer;
alter table public.events add constraint events_scoring_config_active_round_integer check (
  scoring_config is null
  or not (scoring_config ? 'activeRound')
  or jsonb_typeof(scoring_config->'activeRound') = 'null'
  or (
    jsonb_typeof(scoring_config->'activeRound') = 'number'
    and (scoring_config->>'activeRound')::numeric >= 1
    and (scoring_config->>'activeRound')::numeric = floor((scoring_config->>'activeRound')::numeric)
  )
) not valid;

-- ===========================================================================
-- 8. is_project_team_member: internal only (used by SECURITY DEFINER functions)
-- ===========================================================================
revoke all on function public.is_project_team_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.is_project_team_member(uuid, uuid) to service_role;

-- ===========================================================================
-- 1. Parent-side invariants
-- ===========================================================================

-- projects.event_id: only into an event the caller belongs to, never once judging,
-- prize or vote data exists. Stale tracks/assignments of the old event are dropped.
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

drop trigger if exists guard_project_event_change on public.projects;
create trigger guard_project_event_change
  before update of event_id on public.projects
  for each row execute function public.guard_project_event_change();

create or replace function public.cleanup_project_after_event_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.project_tracks pt
  using public.event_tracks et
  where pt.project_id = new.id
    and et.track_id = pt.track_id
    and et.event_id is distinct from new.event_id;

  delete from public.project_assignments pa
  where pa.project_id = new.id
    and pa.event_id is distinct from new.event_id;

  return new;
end;
$$;

drop trigger if exists cleanup_project_after_event_change on public.projects;
create trigger cleanup_project_after_event_change
  after update of event_id on public.projects
  for each row
  when (old.event_id is distinct from new.event_id)
  execute function public.cleanup_project_after_event_change();

-- project_tracks: track must belong to the project's event (all writers).
create or replace function public.enforce_project_track_same_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.projects p
    join public.event_tracks et on et.event_id = p.event_id
    where p.id = new.project_id and et.track_id = new.track_id
  ) then
    raise exception 'Track does not belong to the project''s event' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_project_track_same_event on public.project_tracks;
create trigger enforce_project_track_same_event
  before insert or update on public.project_tracks
  for each row execute function public.enforce_project_track_same_event();

-- prizes.track_id: cannot move a prize with winners to a track of another event.
create or replace function public.guard_prize_track_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.track_id is distinct from old.track_id and exists (
    select 1
    from public.prize_winners w
    join public.projects p on p.id = w.project_id
    where w.prize_id = new.id
      and p.event_id is distinct from (select et.event_id from public.event_tracks et where et.track_id = new.track_id)
  ) then
    raise exception 'Prize has winners from this event; it cannot move to another event''s track'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_prize_track_change on public.prizes;
create trigger guard_prize_track_change
  before update of track_id on public.prizes
  for each row execute function public.guard_prize_track_change();

-- ===========================================================================
-- 4. Rubric resolution with client precedence
-- ===========================================================================

-- Mirrors getTrackScoringConfigForRound (+ DefaultScoring's raw fallback):
--   1. event_tracks.scoring_criteria.rounds[round]          (normalized)
--   2. scoring_config.rounds[round].tracks[track_id | name]   (normalized; without a
--      criteria array the client falls back to the raw track rubric)
--   3. base = event_tracks.scoring_criteria (normalized) or scoring_config.tracks[track_id | name]
--   4. scoring_config.rounds[round].criteria, when a base exists (normalized)
--   5. base
--   6. raw event_tracks.scoring_criteria.criteria
-- Returns {"criteria": [...], "normalized": bool}.
create or replace function public.project_score_rubric(p_track_id uuid, p_round integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text;
  v_sc jsonb;
  v_cfg jsonb;
  v_round jsonb;
  v_round_track jsonb;
  v_base jsonb;
  v_base_normalized boolean := false;
begin
  select et.name,
         case when jsonb_typeof(et.scoring_criteria) = 'object' then et.scoring_criteria else '{}'::jsonb end,
         case when jsonb_typeof(e.scoring_config) = 'object' then e.scoring_config else '{}'::jsonb end
    into v_name, v_sc, v_cfg
  from public.event_tracks et
  join public.events e on e.event_id = et.event_id
  where et.track_id = p_track_id;

  if not found then
    return jsonb_build_object('criteria', '[]'::jsonb, 'normalized', false);
  end if;

  -- 1. per-track round override
  if jsonb_typeof(v_sc->'rounds') = 'object'
     and jsonb_typeof(v_sc->'rounds'->(p_round::text)->'criteria') = 'array' then
    return jsonb_build_object('criteria', v_sc->'rounds'->(p_round::text)->'criteria', 'normalized', true);
  end if;

  -- 2. event round config
  if jsonb_typeof(v_cfg->'rounds') = 'array' then
    select r into v_round
    from jsonb_array_elements(v_cfg->'rounds') r
    where public.jsonb_to_numeric_or_null(r->'round_number') = p_round
    limit 1;
  end if;

  if jsonb_typeof(v_round->'tracks') = 'object' then
    v_round_track := v_round->'tracks'->(p_track_id::text);
    if v_round_track is null or jsonb_typeof(v_round_track) <> 'object' then
      select t.value into v_round_track
      from jsonb_each(v_round->'tracks') t
      where jsonb_typeof(t.value) = 'object' and t.value->>'name' = v_name
      limit 1;
    end if;
    if jsonb_typeof(v_round_track) = 'object' then
      if jsonb_typeof(v_round_track->'criteria') = 'array' then
        return jsonb_build_object('criteria', v_round_track->'criteria', 'normalized', true);
      end if;
      -- client returns undefined here and DefaultScoring uses the raw track rubric
      return jsonb_build_object(
        'criteria', case when jsonb_typeof(v_sc->'criteria') = 'array' then v_sc->'criteria' else '[]'::jsonb end,
        'normalized', false);
    end if;
  end if;

  -- 3. base rubric
  if jsonb_typeof(v_sc->'criteria') = 'array' then
    v_base := v_sc->'criteria';
    v_base_normalized := true;
  elsif jsonb_typeof(v_cfg->'tracks') = 'object' then
    if jsonb_typeof(v_cfg->'tracks'->(p_track_id::text)->'criteria') = 'array' then
      v_base := v_cfg->'tracks'->(p_track_id::text)->'criteria';
    else
      select t.value->'criteria' into v_base
      from jsonb_each(v_cfg->'tracks') t
      where jsonb_typeof(t.value) = 'object' and t.value->>'name' = v_name
        and jsonb_typeof(t.value->'criteria') = 'array'
      limit 1;
    end if;
  end if;

  -- 4. round-wide criteria replace the base
  if v_base is not null and jsonb_typeof(v_round->'criteria') = 'array' then
    return jsonb_build_object('criteria', v_round->'criteria', 'normalized', true);
  end if;

  -- 5. base
  if v_base is not null then
    return jsonb_build_object('criteria', v_base, 'normalized', v_base_normalized);
  end if;

  return jsonb_build_object('criteria', '[]'::jsonb, 'normalized', false);
end;
$$;

revoke all on function public.project_score_rubric(uuid, integer) from public, anon;
grant execute on function public.project_score_rubric(uuid, integer) to authenticated, service_role;

-- Keep the 0101 name working: the resolved criteria list.
create or replace function public.project_score_criteria(p_track_id uuid, p_round integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.project_score_rubric(p_track_id, p_round)->'criteria';
$$;

-- Null when valid, else an error message.
-- Numeric: number or numeric string within [lo, hi]. Normalized criteria use the client's
-- normalizeCriterion (min || 1, max || 10); raw criteria use QuestionFactory (min ?? 0, max ?? 10).
-- Multiple choice: one of options, or "" (unanswered).
create or replace function public.project_score_values_error(p_track_id uuid, p_round integer, p_scores jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rubric jsonb := public.project_score_rubric(p_track_id, p_round);
  v_normalized boolean := coalesce((v_rubric->>'normalized')::boolean, false);
  v_key text;
  v_value jsonb;
  v_criterion jsonb;
  v_num numeric;
  v_min numeric;
  v_max numeric;
  v_lo numeric;
  v_hi numeric;
begin
  if p_scores is null or jsonb_typeof(p_scores) <> 'object' then
    return 'Scores must be an object keyed by criterion id';
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_scores) loop
    select c into v_criterion
    from jsonb_array_elements(v_rubric->'criteria') c
    where jsonb_typeof(c) = 'object' and c->>'id' = v_key
    limit 1;

    if v_criterion is null then
      return format('Unknown scoring criterion "%s" for this track', v_key);
    end if;

    if coalesce(v_criterion->>'type', 'numeric') = 'multiplechoice' then
      if not (
        jsonb_typeof(v_value) in ('string', 'number') and (
          (v_value #>> '{}') = ''
          or exists (
            select 1
            from jsonb_array_elements_text(
              case when jsonb_typeof(v_criterion->'options') = 'array' then v_criterion->'options' else '[]'::jsonb end
            ) o
            where o = (v_value #>> '{}')
          )
        )
      ) then
        return format('Invalid value for scoring criterion "%s"', v_key);
      end if;
    else
      v_num := public.jsonb_to_numeric_or_null(v_value);
      v_min := public.jsonb_to_numeric_or_null(v_criterion->'min');
      v_max := public.jsonb_to_numeric_or_null(v_criterion->'max');
      if v_normalized then
        v_lo := case when v_min is null or v_min = 0 then 1 else v_min end;
        v_hi := case when v_max is null or v_max = 0 then 10 else v_max end;
      else
        v_lo := coalesce(v_min, 0);
        v_hi := coalesce(v_max, 10);
      end if;
      if v_num is null or v_num < v_lo or v_num > v_hi then
        return format('Invalid value for scoring criterion "%s"', v_key);
      end if;
    end if;
    v_criterion := null;
  end loop;

  return null;
end;
$$;

revoke all on function public.project_score_values_error(uuid, integer, jsonb) from public, anon;
grant execute on function public.project_score_values_error(uuid, integer, jsonb) to authenticated, service_role;

-- ===========================================================================
-- 3. Score row trigger: identity checks only when identity changes
-- ===========================================================================
create or replace function public.validate_score_track_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_event uuid;
  v_error text;
  v_identity_changed boolean;
  v_key text;
  v_num numeric;
begin
  v_identity_changed := tg_op = 'INSERT'
    or new.project_id is distinct from old.project_id
    or new.event_id is distinct from old.event_id
    or new.track_id is distinct from old.track_id
    or new.round_number is distinct from old.round_number
    or new.judge_id is distinct from old.judge_id;

  if v_identity_changed then
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
  end if;

  if v_identity_changed or new.scores is distinct from old.scores then
    if new.track_id is null then
      -- Legacy row without a track (only reachable on UPDATE with unchanged identity):
      -- the same criteria keys may be re-scored within the default 1..10 range.
      if new.scores is null or jsonb_typeof(new.scores) <> 'object' then
        raise exception 'Scores must be an object keyed by criterion id' using errcode = '23514';
      end if;
      for v_key in select jsonb_object_keys(new.scores) loop
        if old.scores is null or jsonb_typeof(old.scores) <> 'object' or not (old.scores ? v_key) then
          raise exception 'Unknown scoring criterion "%" for this score', v_key using errcode = '23514';
        end if;
        v_num := public.jsonb_to_numeric_or_null(new.scores->v_key);
        if v_num is null or v_num < 1 or v_num > 10 then
          raise exception 'Invalid value for scoring criterion "%"', v_key using errcode = '23514';
        end if;
      end loop;
    else
      v_error := public.project_score_values_error(new.track_id, new.round_number, new.scores);
      if v_error is not null then
        raise exception '%', v_error using errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_score_track_id on public.project_scores;
create trigger validate_score_track_id
  before insert or update on public.project_scores
  for each row execute function public.validate_score_track_id();

-- ===========================================================================
-- 7. Soft-revoked judge assignments
-- ===========================================================================
alter table public.project_assignments add column if not exists revoked_at timestamptz;

create or replace function public.cleanup_former_judge_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Revoke on demotion/removal (scores and assignments are kept).
  if tg_op in ('UPDATE', 'DELETE') and old.role::text = 'judge' and (
       tg_op = 'DELETE'
       or new.role::text <> 'judge'
       or new.event_id <> old.event_id
       or new.user_id <> old.user_id
     ) then
    update public.project_assignments pa
    set revoked_at = now()
    where pa.user_id = old.user_id
      and pa.event_id = old.event_id
      and pa.role = 'judge'
      and pa.revoked_at is null;
  end if;

  -- Restore on (re-)promotion.
  if tg_op in ('INSERT', 'UPDATE') and new.role::text = 'judge' then
    update public.project_assignments pa
    set revoked_at = null
    where pa.user_id = new.user_id
      and pa.event_id = new.event_id
      and pa.role = 'judge'
      and pa.revoked_at is not null;
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
  after insert or delete or update of role, event_id, user_id on public.user_event_roles
  for each row execute function public.cleanup_former_judge_assignments();

-- ===========================================================================
-- 5. Score write authorization
-- ===========================================================================
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
begin
  if v_uid is null or p_event_id is null or p_judge_id is distinct from v_uid then
    return false;
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.event_id = p_event_id and p.submitted is true
  ) then
    return false;
  end if;

  -- Organizers/owner: as themselves, any configured round.
  if public.is_event_organizer_or_owner(p_event_id, v_uid) then
    return public.event_round_is_configured(p_event_id, p_round);
  end if;

  if not public.is_event_judge(p_event_id, v_uid) then
    return false;
  end if;

  if not exists (
    select 1 from public.project_assignments pa
    where pa.project_id = p_project_id and pa.user_id = v_uid
      and pa.event_id = p_event_id and pa.role = 'judge' and pa.revoked_at is null
  ) then
    return false;
  end if;

  if p_round is distinct from public.event_active_round(p_event_id) then
    return false;
  end if;

  -- Same as the judge dashboard (features/user/dashboards/dashboard/judge/index.tsx):
  -- among this judge's assigned projects, those advanced to the round; when none are
  -- advanced, round 1 falls back to all assigned projects and later rounds show none.
  return exists (
    select 1 from public.project_round_advancements a
    where a.event_id = p_event_id and a.project_id = p_project_id and a.round_number = p_round
  ) or (
    p_round = 1 and not exists (
      select 1
      from public.project_round_advancements a
      join public.project_assignments pa
        on pa.project_id = a.project_id and pa.event_id = a.event_id
       and pa.user_id = v_uid and pa.role = 'judge' and pa.revoked_at is null
      where a.event_id = p_event_id and a.round_number = 1
    )
  );
end;
$$;

revoke all on function public.can_write_project_score(uuid, uuid, integer, uuid) from public, anon;
grant execute on function public.can_write_project_score(uuid, uuid, integer, uuid) to authenticated, service_role;

-- Judges delete only their own rows of the active round; organizers/owner any row.
drop policy if exists "project_scores_delete_own_or_organizer" on public.project_scores;
create policy "project_scores_delete_own_or_organizer"
  on public.project_scores for delete to authenticated
  using (
    event_id is not null and (
      (
        judge_id = (select auth.uid())
        and public.is_event_judge(event_id, (select auth.uid()))
        and round_number = public.event_active_round(event_id)
      )
      or public.is_event_organizer_or_owner(event_id, (select auth.uid()))
    )
  );

-- ===========================================================================
-- 6. Votes: exclude current-team self-votes at tally time; organizer void RPC
-- ===========================================================================
create table if not exists public.project_vote_voids (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null,
  event_id uuid not null,
  project_id uuid not null,
  voter_id uuid not null,
  voted_at timestamptz,
  voided_by uuid not null,
  reason text,
  voided_at timestamptz not null default now()
);
alter table public.project_vote_voids enable row level security;
revoke all on table public.project_vote_voids from public, anon, authenticated;
drop policy if exists "project_vote_voids_select_organizer" on public.project_vote_voids;
create policy "project_vote_voids_select_organizer"
  on public.project_vote_voids for select to authenticated
  using (public.is_event_organizer_or_owner(event_id, (select auth.uid())));
grant select on table public.project_vote_voids to authenticated;

-- Returns the number of votes voided (0 when none matched).
create or replace function public.void_project_vote(
  p_event_id uuid,
  p_project_id uuid,
  p_voter_id uuid,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null or not public.is_event_organizer_or_owner(p_event_id, v_uid) then
    raise exception 'Only organizers can void votes' using errcode = '42501';
  end if;

  with removed as (
    delete from public.project_votes v
    where v.event_id = p_event_id and v.project_id = p_project_id and v.user_id = p_voter_id
    returning v.*
  ), logged as (
    insert into public.project_vote_voids (vote_id, event_id, project_id, voter_id, voted_at, voided_by, reason)
    select r.id, r.event_id, r.project_id, r.user_id, r.created_at, v_uid, nullif(btrim(coalesce(p_reason, '')), '')
    from removed r
    returning 1
  )
  select count(*) into v_count from logged;

  return v_count;
end;
$$;

revoke all on function public.void_project_vote(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.void_project_vote(uuid, uuid, uuid, text) to authenticated;

-- Votes that count: not cast by a current member of the voted project's team.
create or replace function public.project_vote_summary(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'voteCounts',
      case when auth.uid() is not null and public.is_event_organizer_or_owner(p_event_id, auth.uid()) then
        coalesce((select jsonb_object_agg(project_id, n) from (
          select v.project_id, count(*) n
          from public.project_votes v
          where v.event_id = p_event_id
            and not public.is_project_team_member(v.project_id, v.user_id)
          group by v.project_id
        ) counts), '{}'::jsonb)
      else '{}'::jsonb end,
    'userVotes',
      coalesce((select jsonb_agg(project_id) from public.project_votes
                where event_id = p_event_id and user_id = auth.uid()), '[]'::jsonb),
    'ownProjectIds',
      case when auth.uid() is null then '[]'::jsonb else
        coalesce((select jsonb_agg(p.id) from public.projects p
                  where p.event_id = p_event_id and public.is_project_team_member(p.id, auth.uid())), '[]'::jsonb)
      end,
    'votingOpensAt', (select e.voting_opens_at from public.events e where e.event_id = p_event_id),
    'votingClosesAt', (select e.voting_closes_at from public.events e where e.event_id = p_event_id)
  );
$$;

revoke all on function public.project_vote_summary(uuid) from public;
grant execute on function public.project_vote_summary(uuid) to anon, authenticated;

create or replace function public.project_vote_results(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_event_organizer_or_owner(p_event_id, auth.uid()) then
    raise exception 'Only organizers can view voting results' using errcode = '42501';
  end if;

  return (
    with counted as (
      select v.*
      from public.project_votes v
      where v.event_id = p_event_id
        and not public.is_project_team_member(v.project_id, v.user_id)
    )
    select jsonb_build_object(
      'eventId', p_event_id,
      'totalVotes', (select count(*) from counted),
      'totalVoters', (select count(distinct user_id) from counted),
      'excludedSelfVotes', (select count(*) from public.project_votes v where v.event_id = p_event_id) - (select count(*) from counted),
      'results', coalesce((
        select jsonb_agg(row_data order by n desc)
        from (
          select count(*) n,
                 jsonb_build_object(
                   'projectId', p.id,
                   'projectName', coalesce(p.project_name, 'Untitled Project'),
                   'leadName', coalesce(p.lead_name, 'Unknown'),
                   'coverImageUrl', p.cover_image_url,
                   'voteCount', count(*),
                   'voters', jsonb_agg(c.user_id)
                 ) row_data
          from counted c
          join public.projects p on p.id = c.project_id
          group by p.id
        ) grouped
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.project_vote_results(uuid) from public, anon;
grant execute on function public.project_vote_results(uuid) to authenticated;

-- JUDGE-011: unknown event -> P0002 (no_data_found) so the API can answer 404.
create or replace function public.assert_popular_voting_open(p_event_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_opens timestamptz;
  v_closes timestamptz;
begin
  select e.voting_opens_at, e.voting_closes_at into v_opens, v_closes
  from public.events e where e.event_id = p_event_id;

  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if v_opens is not null and now() < v_opens then
    raise exception 'Voting has not opened yet' using errcode = '42501';
  end if;
  if v_closes is not null and now() >= v_closes then
    raise exception 'Voting has closed' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_popular_voting_open(uuid) from public, anon;
grant execute on function public.assert_popular_voting_open(uuid) to authenticated, service_role;

commit;
