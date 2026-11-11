#!/usr/bin/env python3
"""Offline-only PostgreSQL regression for pricing_tiers.current_quantity.

Applies the real checkout migration (202611060301) and the fix (202611110202)
to a minimal fixture in a disposable Docker PostgreSQL container, then drives
purchases through register_event_checkout / apply_event_checkout. Never
accepts a database URL. Requires Docker.
"""
from concurrent.futures import ThreadPoolExecutor
from rls_test_harness import Database, Checks

FIX = "202611110202_sync_pricing_tier_current_quantity.sql"
E = "00000000-0000-0000-0000-0000000000e1"
SINGLE = "00000000-0000-0000-0000-0000000000a1"  # bundle_size 1
TEAM = "00000000-0000-0000-0000-0000000000a3"  # bundle_size 3

SCHEMA = f"""
CREATE ROLE service_role NOLOGIN;
CREATE TYPE payment_status AS ENUM ('processing','paid','canceled','refunded');
CREATE TABLE pricing_tiers(id uuid PRIMARY KEY,event_id uuid,name text,bundle_size integer,is_active boolean,
  max_quantity integer,current_quantity integer DEFAULT 0);
CREATE TABLE user_event_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,event_id uuid,
  stripe_customer_id text,stripe_session_id text,stripe_payment_intent_id text,pricing_id uuid,
  payment_status payment_status,amount_paid integer,currency text DEFAULT 'usd',updated_at timestamptz,
  UNIQUE(user_id,event_id));
CREATE TABLE event_tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid,payment_id uuid,
  purchased_by_user_id uuid,ticket_status text,assigned_to_user_id uuid,assigned_at timestamptz);
CREATE TABLE user_event_roles(event_id uuid,user_id uuid,role text,UNIQUE(user_id,event_id));
INSERT INTO pricing_tiers VALUES
  ('{SINGLE}','{E}','Single',1,true,50,0),
  ('{TEAM}','{E}','Team',3,true,10,0);
"""


def user(n):
    return f"00000000-0000-0000-0001-{n:012d}"


def main():
    checks = Checks()
    with Database("pricing-tier-quantity") as db:
        db.sql(SCHEMA)
        db.migrate("202611060301_checkout_attempts.sql")

        def register(n, tier, session):
            db.sql(f"SELECT register_event_checkout('{user(n)}','{E}','{tier}','cus','{session}')")

        def apply(session, intent, status):
            sess = "NULL" if session is None else f"'{session}'"
            return db.sql(f"SELECT apply_event_checkout({sess},'{intent}','{status}',100,'usd')")

        def count(tier):
            return db.sql(f"SELECT current_quantity FROM pricing_tiers WHERE id='{tier}'")

        def paid_sum(tier):
            return db.sql("SELECT coalesce(sum(bundle_size),0) FROM payment_checkout_attempts "
                          f"WHERE pricing_id='{tier}' AND status='paid'")

        # Existing sales before the fix: the count never moves (the bug).
        register(1, SINGLE, "cs_old1")
        apply("cs_old1", "pi_old1", "paid")
        register(2, TEAM, "cs_old2")
        apply("cs_old2", "pi_old2", "paid")
        checks.expect("bug: paid purchase does not count before the fix", count(SINGLE), "0")
        db.sql(f"UPDATE pricing_tiers SET current_quantity=40 WHERE id='{TEAM}'")  # stale, as if hand-edited

        db.migrate(FIX)
        checks.expect("backfill counts existing single sale", count(SINGLE), "1")
        checks.expect("backfill counts bundle in tickets and fixes stale count", count(TEAM), "3")
        checks.expect("backfill log has before/after per changed tier",
                      db.sql("SELECT string_agg(tier_name||':'||before_quantity||'->'||after_quantity, ',' ORDER BY tier_name) "
                             "FROM pricing_tier_quantity_backfill_log"),
                      "Single:0->1,Team:40->3")
        db.migrate(FIX)  # Re-running must not double count.
        checks.expect("re-running the migration keeps the count", count(TEAM), "3")
        checks.expect("re-run logs nothing new", db.sql("SELECT count(*) FROM pricing_tier_quantity_backfill_log"), "2")

        db.sql(f"UPDATE pricing_tiers SET current_quantity=9 WHERE id='{TEAM}'")
        checks.expect("dry-run recount reports drift",
                      db.sql("SELECT before_quantity||'->'||after_quantity||':'||changed "
                             f"FROM recount_pricing_tier_current_quantity(false) WHERE pricing_id='{TEAM}'"),
                      "9->3:true")
        checks.expect("dry-run recount does not write", count(TEAM), "9")
        db.sql("SELECT count(*) FROM recount_pricing_tier_current_quantity(true)")
        checks.expect("applied recount writes", count(TEAM), "3")

        # Live transitions.
        register(3, TEAM, "cs3")
        checks.expect("processing checkout does not count", count(TEAM), "3")
        apply("cs3", "pi3", "paid")
        checks.expect("paid adds bundle_size", count(TEAM), "6")
        apply("cs3", "pi3", "paid")
        db.sql("UPDATE payment_checkout_attempts SET status='paid' WHERE session_id='cs3'")
        checks.expect("paid -> paid retries are no-ops", count(TEAM), "6")
        apply("cs3", "pi3", "canceled")
        checks.expect("late cancel of a paid checkout is ignored", count(TEAM), "6")
        register(4, TEAM, "cs4")
        apply("cs4", "pi4", "canceled")
        checks.expect("canceled checkout does not count", count(TEAM), "6")
        apply("cs4", "pi4", "paid")
        checks.expect("canceled -> paid counts", count(TEAM), "9")
        apply(None, "pi3", "refunded")
        checks.expect("refund subtracts bundle_size", count(TEAM), "6")
        apply(None, "pi3", "refunded")
        checks.expect("refund retry is a no-op", count(TEAM), "6")
        db.sql(f"UPDATE pricing_tiers SET current_quantity=1 WHERE id='{TEAM}'")
        apply(None, "pi4", "refunded")
        checks.expect("refund never goes below zero", count(TEAM), "0")
        db.sql("SELECT count(*) FROM recount_pricing_tier_current_quantity(true)")

        # Moving a paid attempt between tiers moves the count.
        db.sql(f"UPDATE payment_checkout_attempts SET pricing_id='{SINGLE}' WHERE session_id='cs_old2'")
        checks.expect("tier move removes from old tier", count(TEAM), "0")
        checks.expect("tier move adds to new tier", count(SINGLE), "4")
        db.sql(f"UPDATE payment_checkout_attempts SET pricing_id='{TEAM}' WHERE session_id='cs_old2'")

        # Concurrency: 20 buyers, each webhook delivered 3 times at once.
        for n in range(100, 120):
            register(n, TEAM, f"cs{n}")
        jobs = [f"cs{n}" for n in range(100, 120) for _ in range(3)]
        with ThreadPoolExecutor(max_workers=12) as pool:
            list(pool.map(lambda s: apply(s, "pi" + s[2:], "paid"), jobs))
        checks.expect("concurrent purchases and retries are all counted once", count(TEAM), paid_sum(TEAM))
        checks.expect("concurrent total is 21 bundles of 3", count(TEAM), "63")
        refunds = [f"pi{n}" for n in range(100, 110) for _ in range(2)]
        with ThreadPoolExecutor(max_workers=12) as pool:
            list(pool.map(lambda i: apply(None, i, "refunded"), refunds))
        checks.expect("concurrent refunds and retries subtract once", count(TEAM), "33")
        checks.expect("count matches paid attempts after refunds", count(TEAM), paid_sum(TEAM))

        # Privileges.
        checks.expect("API roles cannot call the trigger or recount functions",
                      db.sql("SELECT bool_or(has_function_privilege(r, f, 'execute')) FROM "
                             "unnest(array['anon','authenticated']) r, unnest(array["
                             "'public.sync_pricing_tier_current_quantity()',"
                             "'public.recount_pricing_tier_current_quantity(boolean)']) f"),
                      "f")
        checks.expect("API roles cannot read the backfill log",
                      db.sql("SELECT bool_or(has_table_privilege(r, 'public.pricing_tier_quantity_backfill_log', 'select')) "
                             "FROM unnest(array['anon','authenticated']) r"),
                      "f")
    checks.finish()


if __name__ == "__main__":
    main()
