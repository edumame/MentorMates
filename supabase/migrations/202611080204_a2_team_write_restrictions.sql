-- A2 / ORG-018: team formation could be bypassed through PostgREST.
--
-- The previous ALL policies let any signed-in user create teams in any event
-- (created_by = self) and insert themself into any team as 'lead'
-- (user_id = self), without event membership, team_formation_enabled,
-- capacity or the lead's consent. All participant team actions go through
-- app/api/events/[eventId]/teams, which performs those checks and then writes
-- with the service role, so direct client writes are limited to organizers and
-- admins. Members may still remove themselves (leave a team).

drop policy if exists "Lead or organizer manages teams" on public.teams;
drop policy if exists "Organizers manage teams" on public.teams;
create policy "Organizers manage teams"
  on public.teams
  for all
  to authenticated
  using (
    public.is_event_organizer(event_id, (select auth.uid()))
    or public.is_admin_user((select auth.uid()))
  )
  with check (
    public.is_event_organizer(event_id, (select auth.uid()))
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists "Lead user or organizer manages members" on public.team_members;
drop policy if exists "Organizers manage team members" on public.team_members;
create policy "Organizers manage team members"
  on public.team_members
  for all
  to authenticated
  using (
    public.is_event_organizer(event_id, (select auth.uid()))
    or public.is_admin_user((select auth.uid()))
  )
  with check (
    (
      public.is_event_organizer(event_id, (select auth.uid()))
      or public.is_admin_user((select auth.uid()))
    )
    -- The membership's event must be the team's event.
    and exists (
      select 1 from public.teams t
       where t.id = team_members.team_id
         and t.event_id = team_members.event_id
    )
  );

drop policy if exists "Members can leave their team" on public.team_members;
create policy "Members can leave their team"
  on public.team_members
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
