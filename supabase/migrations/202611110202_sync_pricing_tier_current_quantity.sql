-- Audit 093: pricing_tiers.current_quantity is never incremented, so tiers
-- always show 0 sold and max_quantity is never reached.
--
-- Since 202611060301 every checkout is its own payment_checkout_attempts row
-- with its own bundle_size and status ('processing' | 'paid' | 'canceled' |
-- 'refunded'), written only by register_event_checkout / apply_event_checkout.
-- current_quantity is now defined as:
--
--   sum(bundle_size) of payment_checkout_attempts with status = 'paid'
--   and pricing_id = the tier
--
-- i.e. tickets sold, matching the column comment.
--
-- 1. A trigger on payment_checkout_attempts keeps that sum up to date:
--    a row entering 'paid' adds its bundle_size, a row leaving 'paid'
--    (refund, delete) subtracts it, never going below 0. paid -> paid
--    (a retried webhook) changes nothing, so it is idempotent. The counter
--    is changed with a single UPDATE ... SET current_quantity =
--    current_quantity + n, which takes the tier row lock, so concurrent
--    purchases of the same tier serialize and none is lost.
-- 2. recount_pricing_tier_current_quantity(p_apply) recomputes the sum from
--    the paid attempts. With p_apply => false it only reports; with true it
--    also writes. It returns one row per tier that has sales or a non-zero
--    count, with before/after values.
-- 3. A one-time backfill runs the recount, prints every changed tier as a
--    NOTICE and stores the before/after counts in
--    pricing_tier_quantity_backfill_log so they can be reviewed afterwards
--    (the Supabase SQL editor does not show notices):
--      select * from public.pricing_tier_quantity_backfill_log order by event_id, tier_name;
--
-- Not counted: legacy user_event_payments rows marked paid without a
-- stripe_session_id (202611060301 only adopted rows with a session id).
--
-- Re-running is safe: functions and trigger are replaced and the backfill
-- recomputes rather than adds (a re-run logs 0 changed tiers).

begin;

-- ---------------------------------------------------------------------------
-- 1. Trigger
-- ---------------------------------------------------------------------------
create or replace function public.sync_pricing_tier_current_quantity()
returns trigger
language plpgsql
-- Writes pricing_tiers from apply_event_checkout's transaction regardless of
-- the caller, and must not be blocked by the archived-event guard on
-- pricing_tiers (a refund on an archived event still has to be counted).
security definer
set search_path = public
as $$
declare
  v_old_tier uuid;
  v_old_qty integer := 0;
  v_new_tier uuid;
  v_new_qty integer := 0;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.status = 'paid' and old.pricing_id is not null then
    v_old_tier := old.pricing_id;
    v_old_qty := old.bundle_size;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.status = 'paid' and new.pricing_id is not null then
    v_new_tier := new.pricing_id;
    v_new_qty := new.bundle_size;
  end if;

  if v_old_tier is not distinct from v_new_tier then
    -- Same tier (or no tier on either side): apply the net change once.
    if v_new_tier is not null and v_new_qty <> v_old_qty then
      update public.pricing_tiers
      set current_quantity = greatest(coalesce(current_quantity, 0) + v_new_qty - v_old_qty, 0)
      where id = v_new_tier;
    end if;
    return null;
  end if;

  if v_old_tier is not null then
    update public.pricing_tiers
    set current_quantity = greatest(coalesce(current_quantity, 0) - v_old_qty, 0)
    where id = v_old_tier;
  end if;
  if v_new_tier is not null then
    update public.pricing_tiers
    set current_quantity = coalesce(current_quantity, 0) + v_new_qty
    where id = v_new_tier;
  end if;
  return null;
end;
$$;

revoke all on function public.sync_pricing_tier_current_quantity() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Recount
-- ---------------------------------------------------------------------------
create or replace function public.recount_pricing_tier_current_quantity(p_apply boolean default false)
returns table (
  pricing_id uuid,
  event_id uuid,
  tier_name text,
  before_quantity integer,
  after_quantity integer,
  changed boolean
)
language plpgsql
set search_path = public
as $$
begin
  if p_apply then
    -- Hold off checkout writes until commit so no purchase or refund lands
    -- between the recount and the trigger taking over.
    lock table public.payment_checkout_attempts in share row exclusive mode;
    lock table public.pricing_tiers in share row exclusive mode;
  end if;

  -- One statement: the CTEs read the counts before the UPDATE applies, so
  -- before_quantity is the stored value and after_quantity the recount.
  return query
  with sold as (
    select a.pricing_id as tier_id, sum(a.bundle_size)::integer as quantity
    from public.payment_checkout_attempts a
    where a.status = 'paid' and a.pricing_id is not null
    group by a.pricing_id
  ),
  recount as (
    select t.id as tier_id, t.event_id as tier_event_id, t.name as name,
           t.current_quantity as before_q, coalesce(sold.quantity, 0) as after_q
    from public.pricing_tiers t
    left join sold on sold.tier_id = t.id
    where coalesce(t.current_quantity, 0) <> 0 or sold.quantity is not null
  ),
  applied as (
    update public.pricing_tiers t
    set current_quantity = recount.after_q
    from recount
    where p_apply
      and t.id = recount.tier_id
      and t.current_quantity is distinct from recount.after_q
    returning t.id
  )
  select recount.tier_id, recount.tier_event_id, recount.name, recount.before_q, recount.after_q,
         recount.before_q is distinct from recount.after_q
  from recount
  order by recount.tier_event_id, recount.name;
end;
$$;

revoke all on function public.recount_pricing_tier_current_quantity(boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Install the trigger and backfill atomically
-- ---------------------------------------------------------------------------
lock table public.payment_checkout_attempts in share row exclusive mode;

drop trigger if exists sync_pricing_tier_current_quantity on public.payment_checkout_attempts;
create trigger sync_pricing_tier_current_quantity
  after insert or delete or update of status, pricing_id, bundle_size
  on public.payment_checkout_attempts
  for each row execute function public.sync_pricing_tier_current_quantity();

create table if not exists public.pricing_tier_quantity_backfill_log (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  pricing_id uuid not null,
  event_id uuid,
  tier_name text,
  before_quantity integer,
  after_quantity integer not null
);
alter table public.pricing_tier_quantity_backfill_log enable row level security;
revoke all on public.pricing_tier_quantity_backfill_log from public, anon, authenticated;

do $$
declare
  r record;
  v_tiers integer := 0;
  v_changed integer := 0;
begin
  for r in select * from public.recount_pricing_tier_current_quantity(true) loop
    v_tiers := v_tiers + 1;
    if r.changed then
      v_changed := v_changed + 1;
      insert into public.pricing_tier_quantity_backfill_log
        (pricing_id, event_id, tier_name, before_quantity, after_quantity)
      values (r.pricing_id, r.event_id, r.tier_name, r.before_quantity, r.after_quantity);
      raise notice 'pricing tier % (%, event %): current_quantity % -> %',
        r.pricing_id, r.tier_name, r.event_id, coalesce(r.before_quantity::text, 'null'), r.after_quantity;
    end if;
  end loop;
  raise notice 'sync_pricing_tier_current_quantity backfill: % tier(s) with sales or a non-zero count, % changed', v_tiers, v_changed;
end;
$$;

commit;
