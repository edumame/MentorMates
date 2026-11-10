-- A1 (audit 2026-11-08): popular-vote privacy and integrity.
--   JUDGE-002  ballots are private (voter sees own, organizers/owner see all);
--              live totals only returned to organizers/owner.
--   JUDGE-010  only participants/mentors vote; no votes for your own project;
--              only submitted, non-private projects are votable.
--   JUDGE-011  optional organizer-controlled voting window
--              (events.voting_opens_at / voting_closes_at, null = unrestricted);
--              un-voting goes through remove_project_vote so the window applies.
-- Idempotent: add column if not exists / create or replace / drop policy if exists.

begin;

alter table public.events add column if not exists voting_opens_at timestamptz;
alter table public.events add column if not exists voting_closes_at timestamptz;

alter table public.events drop constraint if exists events_voting_window_order;
alter table public.events add constraint events_voting_window_order
  check (voting_opens_at is null or voting_closes_at is null or voting_opens_at < voting_closes_at);

-- ---------------------------------------------------------------------------
-- Ballot privacy
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone can view project votes" on public.project_votes;
drop policy if exists "Users can delete their own votes" on public.project_votes;
drop policy if exists "project_votes_select_own_or_organizer" on public.project_votes;

create policy "project_votes_select_own_or_organizer"
  on public.project_votes for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_event_organizer_or_owner(event_id, (select auth.uid()))
  );

-- Writes only through cast_project_vote / remove_project_vote.
revoke all on table public.project_votes from anon;
revoke insert, update, delete, truncate on table public.project_votes from authenticated;

-- ---------------------------------------------------------------------------
-- Shared checks
-- ---------------------------------------------------------------------------
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
    raise exception 'Event not found' using errcode = '22023';
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

create or replace function public.is_project_team_member(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    join auth.users u on u.id = p_user_id
    where p.id = p_project_id
      and u.email is not null
      and (
        lower(coalesce(p.lead_email, '')) = lower(u.email)
        or exists (select 1 from unnest(coalesce(p.teammates, '{}'::text[])) t where lower(t) = lower(u.email))
      )
  ) or exists (
    select 1
    from public.teams t
    join public.team_members tm on tm.team_id = t.id
    where t.project_id = p_project_id and tm.user_id = p_user_id
  );
$$;

revoke all on function public.is_project_team_member(uuid, uuid) from public, anon;
grant execute on function public.is_project_team_member(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- cast_project_vote (replaces 202611060202 version; same signature/return)
-- ---------------------------------------------------------------------------
create or replace function public.cast_project_vote(p_event_id uuid, p_project_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  votes integer;
begin
  -- Organizers/admins see live totals and judges score: only participants and mentors vote.
  if actor is null or not exists (
    select 1 from public.user_event_roles
    where event_id = p_event_id and user_id = actor and role::text in ('participant', 'mentor')
  ) then
    raise exception 'Not eligible to vote' using errcode = '42501';
  end if;

  perform public.assert_popular_voting_open(p_event_id);

  if not exists (
    select 1 from public.projects
    where id = p_project_id and event_id = p_event_id and submitted is true and private is false
  ) then
    raise exception 'Project is not open for voting in this event' using errcode = '22023';
  end if;

  if public.is_project_team_member(p_project_id, actor) then
    raise exception 'You cannot vote for your own project' using errcode = '42501';
  end if;

  -- Per-user/event serialization, including simultaneous votes for distinct projects.
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':' || actor::text, 0));
  select count(*) into votes from public.project_votes where event_id = p_event_id and user_id = actor;
  if exists (select 1 from public.project_votes where project_id = p_project_id and user_id = actor) then
    return greatest(0, 3 - votes);
  end if;
  if votes >= 3 then
    raise exception 'You can only vote for 3 projects per event' using errcode = '23514';
  end if;
  insert into public.project_votes(project_id, user_id, event_id) values (p_project_id, actor, p_event_id);
  return 3 - votes - 1;
end;
$$;

revoke all on function public.cast_project_vote(uuid, uuid) from public, anon;
grant execute on function public.cast_project_vote(uuid, uuid) to authenticated;

-- Returns remaining votes after removing the caller's vote (no-op if absent).
create or replace function public.remove_project_vote(p_event_id uuid, p_project_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  votes integer;
begin
  if actor is null then
    raise exception 'Not eligible to vote' using errcode = '42501';
  end if;

  perform public.assert_popular_voting_open(p_event_id);

  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':' || actor::text, 0));
  delete from public.project_votes
  where event_id = p_event_id and project_id = p_project_id and user_id = actor;
  select count(*) into votes from public.project_votes where event_id = p_event_id and user_id = actor;
  return greatest(0, 3 - votes);
end;
$$;

revoke all on function public.remove_project_vote(uuid, uuid) from public, anon;
grant execute on function public.remove_project_vote(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- project_vote_summary: own ballot for everyone, totals for organizers/owner only.
-- ---------------------------------------------------------------------------
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
          select project_id, count(*) n from public.project_votes where event_id = p_event_id group by project_id
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

commit;
