-- A2 / ORG-013: throttle role-password guesses and keep role password writes
-- behind the API (which enforces minimum lengths and organizer checks).

create table if not exists public.role_password_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(event_id) on delete cascade,
  role public.event_role not null,
  failed_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  primary key (user_id, event_id, role)
);

alter table public.role_password_attempts enable row level security;
-- No policies: only the service role (API routes) reads or writes attempts.
revoke all on public.role_password_attempts from anon, authenticated;

-- Returns the time until which the user is locked out (null when allowed).
create or replace function public.role_password_locked_until(
  p_user_id uuid, p_event_id uuid, p_role public.event_role
)
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select locked_until
    from public.role_password_attempts
   where user_id = p_user_id and event_id = p_event_id and role = p_role
     and locked_until > now();
$$;

-- Records a failed guess atomically. After p_max_failures failures inside
-- p_window the user is locked for p_window; each further lockout doubles
-- (capped at 24 hours). Returns locked_until (null when not locked).
create or replace function public.record_role_password_failure(
  p_user_id uuid,
  p_event_id uuid,
  p_role public.event_role,
  p_max_failures integer default 5,
  p_window interval default interval '15 minutes'
)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.role_password_attempts;
begin
  insert into public.role_password_attempts as a (user_id, event_id, role, failed_count, window_started_at)
  values (p_user_id, p_event_id, p_role, 1, now())
  on conflict (user_id, event_id, role) do update
    set failed_count = case
          when a.window_started_at < now() - p_window and coalesce(a.locked_until, '-infinity') < now()
            then 1
          else a.failed_count + 1
        end,
        window_started_at = case
          when a.window_started_at < now() - p_window and coalesce(a.locked_until, '-infinity') < now()
            then now()
          else a.window_started_at
        end
  returning * into v_row;

  if v_row.failed_count >= p_max_failures then
    update public.role_password_attempts
       set locked_until = now() + least(
             p_window * power(2, greatest(v_row.failed_count - p_max_failures, 0)),
             interval '24 hours'
           )
     where user_id = p_user_id and event_id = p_event_id and role = p_role
     returning locked_until into v_row.locked_until;
    return v_row.locked_until;
  end if;

  return null;
end;
$$;

create or replace function public.clear_role_password_failures(
  p_user_id uuid, p_event_id uuid, p_role public.event_role
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.role_password_attempts
   where user_id = p_user_id and event_id = p_event_id and role = p_role;
$$;

revoke all on function public.role_password_locked_until(uuid, uuid, public.event_role) from public, anon, authenticated;
revoke all on function public.record_role_password_failure(uuid, uuid, public.event_role, integer, interval) from public, anon, authenticated;
revoke all on function public.clear_role_password_failures(uuid, uuid, public.event_role) from public, anon, authenticated;
grant execute on function public.role_password_locked_until(uuid, uuid, public.event_role) to service_role;
grant execute on function public.record_role_password_failure(uuid, uuid, public.event_role, integer, interval) to service_role;
grant execute on function public.clear_role_password_failures(uuid, uuid, public.event_role) to service_role;

-- Role passwords are written only by app/api/roles/set-password (service role,
-- after organizer authorization and length validation). Clients keep read
-- access to (event_id, role) so the UI can show which roles have a password.
revoke insert, update, delete on public.role_passwords from anon, authenticated;

-- Organizer access is invitation-only; an organizer role password can no
-- longer be used (app/api/roles/verify), so remove any stored ones.
-- PROD PRE-CHECK (read-only):
--   select role, count(*) from public.role_passwords
--    where role in ('organizer', 'admin') group by role;
-- The rows (bcrypt hashes) are copied to a service-only quarantine table
-- first so the change can be reverted.
create schema if not exists audit_backup;
revoke all on schema audit_backup from public, anon, authenticated;
create table if not exists audit_backup.role_passwords_staff_20261108
  as select * from public.role_passwords with no data;
revoke all on audit_backup.role_passwords_staff_20261108 from public, anon, authenticated;
insert into audit_backup.role_passwords_staff_20261108
select rp.* from public.role_passwords rp
 where rp.role in ('organizer', 'admin')
   and not exists (
     select 1 from audit_backup.role_passwords_staff_20261108 b
      where b.event_id = rp.event_id and b.role = rp.role
   );

delete from public.role_passwords where role in ('organizer', 'admin');
