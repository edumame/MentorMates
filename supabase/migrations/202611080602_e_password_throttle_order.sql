-- ORG-013 follow-up (lane E): consume_role_password_attempt (A2 0206) charged
-- the per-event/role budget BEFORE checking the per-user lockout. A single
-- locked-out account that kept retrying used up the event's 50/hour budget,
-- so a different user with the correct password got 429.
--
-- New order (rows locked user -> event, same order as
-- clear_role_password_failures, so no lock-order inversion):
--   1. per-user lockout: if locked, refuse without touching the event row;
--   2. per-user budget: the attempt that crosses it locks the user and is
--      refused, again without touching the event row;
--   3. per-event budget: only attempts that will really be evaluated are
--      counted; if the event budget refuses, the user's counter is not
--      charged either.
-- Same signature, defaults, grants and return shape as 0206.
--
-- Deploy: see audit-2026-11-08/final/DEPLOY-CHECKLIST.md. Idempotent.

create or replace function public.consume_role_password_attempt(
  p_user_id uuid,
  p_event_id uuid,
  p_role public.event_role,
  p_max_attempts integer default 5,
  p_window interval default interval '15 minutes',
  p_event_max integer default 50,
  p_event_window interval default interval '1 hour'
)
returns table (allowed boolean, retry_at timestamptz, scope text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.role_password_event_attempts;
  v_user public.role_password_attempts;
  v_decay integer;
begin
  -- 1. per-user lockout
  insert into public.role_password_attempts (user_id, event_id, role, failed_count, window_started_at)
  values (p_user_id, p_event_id, p_role, 0, now()) on conflict do nothing;
  select * into v_user from public.role_password_attempts
   where user_id = p_user_id and event_id = p_event_id and role = p_role for update;

  if v_user.locked_until > now() then
    return query select false, v_user.locked_until, 'user'::text;
    return;
  end if;

  -- 2. per-user budget (decay as in 0206)
  if v_user.last_attempt_at is not null then
    if v_user.last_attempt_at < now() - interval '24 hours' then
      v_user.lockout_count := 0;
      v_user.failed_count := 0;
    else
      v_decay := floor(extract(epoch from (now() - v_user.last_attempt_at)) / extract(epoch from p_window))::integer;
      v_user.failed_count := greatest(v_user.failed_count - v_decay, 0);
    end if;
  end if;

  v_user.failed_count := v_user.failed_count + 1;
  if v_user.failed_count > p_max_attempts then
    v_user.lockout_count := v_user.lockout_count + 1;
    v_user.locked_until := now() + least(
      p_window * power(2, v_user.lockout_count - 1),
      interval '24 hours'
    );
    v_user.failed_count := 0;
    update public.role_password_attempts
       set failed_count = v_user.failed_count,
           lockout_count = v_user.lockout_count,
           locked_until = v_user.locked_until,
           last_attempt_at = now()
     where user_id = p_user_id and event_id = p_event_id and role = p_role;
    return query select false, v_user.locked_until, 'user'::text;
    return;
  end if;

  -- 3. per-event budget, only for attempts that will be evaluated
  insert into public.role_password_event_attempts (event_id, role)
  values (p_event_id, p_role) on conflict do nothing;
  select * into v_event from public.role_password_event_attempts
   where event_id = p_event_id and role = p_role for update;

  if v_event.locked_until > now() then
    return query select false, v_event.locked_until, 'event'::text;
    return;
  end if;
  if v_event.window_started_at < now() - p_event_window then
    v_event.window_started_at := now();
    v_event.attempt_count := 0;
  end if;
  v_event.attempt_count := v_event.attempt_count + 1;
  if v_event.attempt_count > p_event_max then
    v_event.locked_until := v_event.window_started_at + p_event_window;
  end if;
  update public.role_password_event_attempts
     set window_started_at = v_event.window_started_at,
         attempt_count = v_event.attempt_count,
         locked_until = v_event.locked_until
   where event_id = p_event_id and role = p_role;
  if v_event.locked_until > now() then
    return query select false, v_event.locked_until, 'event'::text;
    return;
  end if;

  update public.role_password_attempts
     set failed_count = v_user.failed_count,
         lockout_count = v_user.lockout_count,
         locked_until = v_user.locked_until,
         last_attempt_at = now()
   where user_id = p_user_id and event_id = p_event_id and role = p_role;

  return query select true, null::timestamptz, null::text;
end;
$$;

revoke all on function public.consume_role_password_attempt(uuid, uuid, public.event_role, integer, interval, integer, interval) from public, anon, authenticated;
grant execute on function public.consume_role_password_attempt(uuid, uuid, public.event_role, integer, interval, integer, interval) to service_role;
