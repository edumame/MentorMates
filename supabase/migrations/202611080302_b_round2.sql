-- Lane B round 2 (audit 2026-11-08): PUB-001, PUB-002, ORG-012 / MENT-008
-- Idempotent: safe to re-run. Apply after 202611080301 and A2's 202611080203.
--
-- DEPLOY ORDER: follow audit-2026-11-08/final/DEPLOY-CHECKLIST.md (XL-004).
-- Do not simply ship app code first: the new app also needs RPCs/tables from
-- the other 20261108 migrations. After section 2, select('*') on events fails
-- for anon/authenticated users, and paywall_content is only readable through
-- get_event_paywall_content(); the new app does neither, the old app does.
--
-- Prod pre-checks (run first):
--   -- columns signed-out/organizer pages read must exist (otherwise update the app):
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'events'
--      and column_name in ('event_id','event_name','slug','event_date','location','visibility',
--        'approval_status','external_url','external_redirect_enabled','voting_opens_at',
--        'voting_closes_at','paywall_content','rejection_reason');
--   -- external URLs that the new CHECK would reject (must be 0, or fix them first):
--   select count(*) from public.events where external_url is not null and external_url !~* '^https?://';

-- ── 1. PUB-001: external links ─────────────────────────────────────────────
-- Only http(s) external URLs may be stored (javascript:/data: links were
-- accepted and rendered as hrefs).
alter table public.events drop constraint if exists events_external_url_http;
alter table public.events
  add constraint events_external_url_http
  check (external_url is null or external_url ~* '^https?://[^[:space:]]+$') not valid;
alter table public.events validate constraint events_external_url_http;

-- Admin approval pins the redirect target: a non-admin may not change the
-- external link (or switch the redirect on) of an approved event.
create or replace function public.guard_event_external_redirect()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin')
     or public.is_admin_user(auth.uid()) then
    return new;
  end if;

  if old.approval_status = 'approved'
     and (
       new.external_url is distinct from old.external_url
       or (new.external_redirect_enabled and not coalesce(old.external_redirect_enabled, false))
     ) then
    raise exception 'Changing the external link of an approved event requires admin re-approval'
      using errcode = '42501', hint = 'external_redirect_requires_approval';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_event_external_redirect on public.events;
create trigger guard_event_external_redirect
  before update of external_url, external_redirect_enabled on public.events
  for each row execute function public.guard_event_external_redirect();

-- ── 2. PUB-002: column-level read privileges on events ─────────────────────
-- Built from information_schema so it cannot fail on a column missing in
-- prod, and every current column except the deny-list is readable.
-- NOTE: a column added later is not readable by anon/authenticated until it
-- is granted (re-run this block or add an explicit grant in that migration).
do $$
declare
  anon_deny text[] := array[
    'paywall_content', 'rejection_reason',
    'submitter_email', 'submitter_name', 'organizer_affiliation', 'expected_attendance'
  ];
  authenticated_deny text[] := array['paywall_content'];
  cols text;
begin
  revoke select on public.events from anon;
  revoke select on public.events from authenticated;

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'events'
    and column_name <> all (anon_deny);
  execute format('grant select (%s) on public.events to anon', cols);

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'events'
    and column_name <> all (authenticated_deny);
  execute format('grant select (%s) on public.events to authenticated', cols);
end;
$$;

-- Members-only content: returned only to the event's members, managers and
-- admins (null otherwise).
create or replace function public.get_event_paywall_content(p_event_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  content text;
begin
  if uid is null then
    return null;
  end if;
  if not (
    public.user_has_event_role(p_event_id, uid)
    or public.can_manage_event(p_event_id, uid)
    or public.is_admin_user(uid)
  ) then
    return null;
  end if;
  select e.paywall_content into content from public.events e where e.event_id = p_event_id;
  return content;
end;
$$;

revoke all on function public.get_event_paywall_content(uuid) from public, anon;
grant execute on function public.get_event_paywall_content(uuid) to authenticated;

-- ── 3. ORG-012 / MENT-008: revocable, single-use role invitations ──────────
-- Invite tokens carry the row id (jti). accept-invite (service role) checks
-- the row is pending, unexpired and for the caller's verified email, then
-- marks it accepted, so a link works once and can be revoked.
create table if not exists public.event_role_invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(event_id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email <> ''),
  role text not null check (role in ('participant', 'judge', 'organizer')),
  invited_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid,
  revoked_at timestamptz
);

create index if not exists idx_event_role_invitations_event_email
  on public.event_role_invitations (event_id, email)
  where accepted_at is null and revoked_at is null;

alter table public.event_role_invitations enable row level security;
revoke all on public.event_role_invitations from anon, authenticated;
-- No policies: only the service role reads/writes invitations.

-- Removing someone from an event revokes their outstanding invitations to it.
create or replace function public.revoke_invitations_on_role_removal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.event_role_invitations i
     set revoked_at = now()
   where i.event_id = old.event_id
     and i.accepted_at is null
     and i.revoked_at is null
     and i.email = (select lower(btrim(u.email)) from auth.users u where u.id = old.user_id);
  return old;
end;
$$;

revoke all on function public.revoke_invitations_on_role_removal() from public, anon, authenticated;

drop trigger if exists revoke_invitations_on_role_removal on public.user_event_roles;
create trigger revoke_invitations_on_role_removal
  after delete on public.user_event_roles
  for each row execute function public.revoke_invitations_on_role_removal();

-- ── 4. ORG-014: slugs may not look like event UUIDs (or be empty) ──────────
-- Validated only when a slug is set or changed, so legacy rows stay editable.
create or replace function public.guard_event_slug()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.slug is not null
     and (tg_op = 'INSERT' or new.slug is distinct from old.slug) then
    if btrim(new.slug) = '' then
      raise exception 'Event URL slug cannot be empty' using errcode = '23514';
    end if;
    if new.slug ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Event URL slug cannot look like an event ID' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_event_slug on public.events;
create trigger guard_event_slug
  before insert or update of slug on public.events
  for each row execute function public.guard_event_slug();
