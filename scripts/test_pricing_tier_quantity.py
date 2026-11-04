#!/usr/bin/env python3
"""Test the pricing tier sold-count migration in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Run from repository root.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import time

from test_scraper_quota import CONTAINER, docker, sql

MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/202611050093_sync_pricing_tier_current_quantity.sql"

SCHEMA = """
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE TYPE public.payment_status AS ENUM ('processing', 'paid', 'canceled', 'refunded');
CREATE TABLE public.pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  max_quantity integer,
  current_quantity integer DEFAULT 0,
  bundle_size integer DEFAULT 1
);
ALTER TABLE public.pricing_tiers ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.user_event_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  payment_status public.payment_status NOT NULL DEFAULT 'processing',
  pricing_id uuid REFERENCES public.pricing_tiers(id) ON DELETE SET NULL,
  UNIQUE (user_id, event_id)
);
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_event_payments TO authenticated;
"""


def tier(current=0, bundle=1, max_quantity="NULL"):
    return sql(f"INSERT INTO public.pricing_tiers (current_quantity, bundle_size, max_quantity) "
               f"VALUES ({current}, {bundle}, {max_quantity}) RETURNING id;").stdout.strip()


def payment(tier_id, status="processing"):
    pricing_id = "NULL" if tier_id is None else f"'{tier_id}'"
    return sql(f"INSERT INTO public.user_event_payments (user_id, event_id, payment_status, pricing_id) "
               f"VALUES (gen_random_uuid(), gen_random_uuid(), '{status}', {pricing_id}) RETURNING id;").stdout.strip()


def set_status(payment_id, status):
    sql(f"UPDATE public.user_event_payments SET payment_status = '{status}' WHERE id = '{payment_id}';")


def sold(tier_id):
    return int(sql(f"SELECT current_quantity FROM public.pricing_tiers WHERE id = '{tier_id}';").stdout.strip())


def main():
    migration = MIGRATION.read_text()
    docker("pull", "postgres:16.15", timeout=600)
    try:
        docker("run", "--detach", "--name", CONTAINER, "--network", "none",
               "--tmpfs", "/var/lib/postgresql/data:rw", "--env",
               "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:16.15")
        for _ in range(60):
            if docker("exec", CONTAINER, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", check=False).returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise RuntimeError("Disposable PostgreSQL failed to start")
        sql(SCHEMA)

        # Backfill counts existing paid rows only, replaces stale values, and
        # re-running the migration neither doubles the count nor stacks triggers.
        backfilled = tier(current=7, bundle=2)
        untouched = tier(current=4)
        for status in ("paid", "paid", "processing", "canceled", "refunded"):
            payment(backfilled, status)
        payment(None, "paid")
        sql(migration)
        assert sold(backfilled) == 4, "Two paid bundles of two tickets"
        assert sold(untouched) == 0, "A tier with no paid payments has sold nothing"
        sql(migration)
        assert sold(backfilled) == 4, "Re-applying the migration must not change the count"

        # Paid transition counts once, however many times the webhook is delivered.
        limited = tier(max_quantity=2)
        first = payment(limited)
        assert sold(limited) == 0, "An open checkout is not a sale"
        set_status(first, "paid")
        assert sold(limited) == 1
        set_status(first, "paid")
        assert sold(limited) == 1, "A retried webhook must not count twice"

        # Refund releases the ticket once; a repeated refund event does not.
        set_status(first, "refunded")
        assert sold(limited) == 0
        set_status(first, "refunded")
        assert sold(limited) == 0

        # Tier reaches its limit, which is what the checkout sold-out check reads.
        for _ in range(2):
            set_status(payment(limited), "paid")
        assert sold(limited) == 2

        # Abandoned checkouts do not change the count.
        abandoned = payment(limited)
        set_status(abandoned, "canceled")
        assert sold(limited) == 2

        # Bundles count every ticket, and refund the same number.
        bundled = tier(bundle=5)
        bundle_payment = payment(bundled)
        set_status(bundle_payment, "paid")
        assert sold(bundled) == 5
        set_status(bundle_payment, "refunded")
        assert sold(bundled) == 0

        # A paid row moved to another tier moves its count with it.
        source, target = tier(), tier()
        moved = payment(source, "paid")
        assert sold(source) == 1
        sql(f"UPDATE public.user_event_payments SET pricing_id = '{target}' WHERE id = '{moved}';")
        assert (sold(source), sold(target)) == (0, 1)

        # Deleting a paid row releases it, and the count never goes negative.
        sql(f"DELETE FROM public.user_event_payments WHERE id = '{moved}';")
        assert sold(target) == 0
        drifted = tier()
        drifted_payment = payment(drifted, "paid")
        sql(f"UPDATE public.pricing_tiers SET current_quantity = 0 WHERE id = '{drifted}';")
        set_status(drifted_payment, "refunded")
        assert sold(drifted) == 0, "Count must clamp at zero"

        # A NULL count from older rows is treated as zero.
        null_count = tier()
        sql(f"UPDATE public.pricing_tiers SET current_quantity = NULL WHERE id = '{null_count}';")
        payment(null_count, "paid")
        assert sold(null_count) == 1

        # Deleting a tier leaves the payment and does not fail the cascade.
        deleted = tier()
        orphan = payment(deleted, "paid")
        sql(f"DELETE FROM public.pricing_tiers WHERE id = '{deleted}';")
        set_status(orphan, "refunded")

        # Checkout writes as the buyer, who has no access to pricing_tiers.
        buyer_tier = tier()
        buyer_payment = payment(buyer_tier, "paid")
        denied = sql(f"SET ROLE authenticated; UPDATE public.pricing_tiers SET current_quantity = 9 WHERE id = '{buyer_tier}';", check=False)
        assert denied.returncode != 0 and "permission denied" in denied.stderr, denied.stderr
        sql(f"SET ROLE authenticated; UPDATE public.user_event_payments SET payment_status = 'processing' WHERE id = '{buyer_payment}';")
        assert sold(buyer_tier) == 0

        # Trigger functions are not callable, and nobody else may try.
        for role in ("anon", "authenticated"):
            call = sql(f"SET ROLE {role}; SELECT public.sync_pricing_tier_current_quantity();", check=False)
            assert call.returncode != 0 and "permission denied" in call.stderr, (role, call.stderr)

        # Thirty independent sessions pay at once; no increment may be lost.
        raced = tier()
        payments = [payment(raced) for _ in range(30)]
        with ThreadPoolExecutor(max_workers=30) as pool:
            list(pool.map(lambda payment_id: set_status(payment_id, "paid"), payments))
        assert sold(raced) == 30

        print("PASS: backfill, idempotent transitions, refunds, bundles, tier moves, buyer writes, and concurrency")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
