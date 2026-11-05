#!/usr/bin/env python3
"""Test the checkout fulfillment migration in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Run from repository root.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import time
import uuid

MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/202611050092_fulfill_checkout_session.sql"
CONTAINER = "mentormates-checkout-test-" + uuid.uuid4().hex[:12]
EVENT = "00000000-0000-0000-0000-000000000001"
BUYER = "00000000-0000-0000-0000-000000000002"
TIER = "00000000-0000-0000-0000-000000000003"
FRIEND = "00000000-0000-0000-0000-000000000004"

# Only the columns the function touches, with the production names and types.
SCHEMA = f"""
CREATE TYPE public.payment_status AS ENUM ('processing', 'paid', 'canceled', 'refunded');
CREATE TYPE public.ticket_status_enum AS ENUM ('unassigned', 'assigned', 'used', 'transferred');
CREATE TABLE public.pricing_tiers (id uuid PRIMARY KEY, bundle_size integer DEFAULT 1);
CREATE TABLE public.user_event_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  stripe_customer_id text NOT NULL,
  payment_status public.payment_status NOT NULL DEFAULT 'processing',
  stripe_session_id text,
  stripe_payment_intent_id text,
  amount_paid integer,
  pricing_id uuid REFERENCES public.pricing_tiers(id) ON DELETE SET NULL
);
CREATE TABLE public.event_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  payment_id uuid NOT NULL REFERENCES public.user_event_payments(id) ON DELETE CASCADE,
  purchased_by_user_id uuid NOT NULL,
  assigned_to_user_id uuid,
  ticket_status public.ticket_status_enum DEFAULT 'unassigned'
);
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
INSERT INTO public.pricing_tiers VALUES ('{TIER}', 2);
"""


def docker(*args, input=None, check=True, timeout=90):
    result = subprocess.run(["docker", *args], input=input, text=True,
                            capture_output=True, check=False, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f"Disposable Docker command failed: {result.stderr or result.stdout}")
    return result


def sql(statement, check=True):
    return docker("exec", "-i", CONTAINER, "psql", "-X", "-h", "127.0.0.1", "-U", "postgres",
                  "-v", "ON_ERROR_STOP=1", "-Atq", input=statement, check=check)


def fulfill(session, role="service_role", check=True):
    result = sql(f"SET ROLE {role}; SELECT tickets_issued FROM public.fulfill_checkout_session("
                 f"'cus_1', '{session}', 5000, 'pi_{session}');", check=check)
    return result if not check else result.stdout.strip()


def create_payment(session, status="processing", pricing=f"'{TIER}'"):
    user = uuid.uuid4()
    return sql(f"""INSERT INTO public.user_event_payments
        (user_id, event_id, stripe_customer_id, stripe_session_id, payment_status, pricing_id)
        VALUES ('{user}', '{EVENT}', 'cus_1', '{session}', '{status}', {pricing}) RETURNING id;""").stdout.strip()


def ticket_count(payment):
    return int(sql(f"SELECT count(*) FROM public.event_tickets WHERE payment_id = '{payment}';").stdout.strip())


def buyer_ticket_count(payment):
    return int(sql(f"""SELECT count(*) FROM public.event_tickets AS ticket
        JOIN public.user_event_payments AS payment ON payment.id = ticket.payment_id
        WHERE ticket.payment_id = '{payment}' AND ticket.assigned_to_user_id = payment.user_id
          AND ticket.ticket_status = 'assigned';""").stdout.strip())


def unassigned_ticket_count(payment):
    return int(sql(f"""SELECT count(*) FROM public.event_tickets WHERE payment_id = '{payment}'
        AND assigned_to_user_id IS NULL AND ticket_status = 'unassigned';""").stdout.strip())


def status(payment):
    return sql(f"SELECT payment_status FROM public.user_event_payments WHERE id = '{payment}';").stdout.strip()


def main():
    migration = MIGRATION.read_text()
    # Pull separately: a cold CI runner may need considerably longer than a SQL call.
    docker("pull", "postgres:16.15", timeout=600)
    try:
        docker("run", "--detach", "--name", CONTAINER, "--network", "none",
               "--tmpfs", "/var/lib/postgresql/data:rw", "--env",
               "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:16.15")
        for _ in range(60):
            # The image init server accepts Unix sockets before restarting. TCP
            # readiness only succeeds once the final server is running.
            if docker("exec", CONTAINER, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", check=False).returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise RuntimeError("Disposable PostgreSQL failed to start")
        sql("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;")
        sql(SCHEMA)
        sql(migration)
        sql(migration)  # Production history is empty, so reapplying must be safe.

        for role in ("anon", "authenticated"):
            result = fulfill("cs_denied", role=role, check=False)
            assert result.returncode != 0 and "permission denied" in result.stderr, (role, result.stderr)

        # Sequential redelivery issues the bundle once and records the payment.
        payment = create_payment("cs_redelivery")
        assert fulfill("cs_redelivery") == "t"
        # The buyer's seat is committed with the bundle, not in a later step.
        assert buyer_ticket_count(payment) == 1
        assert unassigned_ticket_count(payment) == 1
        assert fulfill("cs_redelivery") == "f"
        assert ticket_count(payment) == 2
        assert buyer_ticket_count(payment) == 1
        assert unassigned_ticket_count(payment) == 1
        assert status(payment) == "paid"
        saved = sql(f"SELECT amount_paid, stripe_payment_intent_id FROM public.user_event_payments WHERE id = '{payment}';")
        assert saved.stdout.strip() == "5000|pi_cs_redelivery", saved.stdout

        # Twenty independent sessions race to deliver the same event.
        payment = create_payment("cs_concurrent")
        with ThreadPoolExecutor(max_workers=20) as pool:
            results = list(pool.map(fulfill, ["cs_concurrent"] * 20))
        assert results.count("t") == 1 and results.count("f") == 19, results
        assert ticket_count(payment) == 2
        assert buyer_ticket_count(payment) == 1

        # A redelivery does not hand a new ticket to a buyer who gave theirs away.
        payment = create_payment("cs_given_away")
        fulfill("cs_given_away")
        sql(f"""UPDATE public.event_tickets SET assigned_to_user_id = '{FRIEND}'
                WHERE payment_id = '{payment}' AND assigned_to_user_id IS NOT NULL;""")
        assert fulfill("cs_given_away") == "f"
        assert buyer_ticket_count(payment) == 0
        assert unassigned_ticket_count(payment) == 1

        # A buyer who already holds a ticket for the event gets no second one,
        # which would break the .maybeSingle() lookups in join-event-button.
        gift = create_payment("cs_gift")
        fulfill("cs_gift")
        payment = create_payment("cs_holder")
        sql(f"""UPDATE public.event_tickets SET assigned_to_user_id =
                  (SELECT user_id FROM public.user_event_payments WHERE id = '{payment}')
                WHERE payment_id = '{gift}' AND assigned_to_user_id IS NOT NULL;""")
        assert fulfill("cs_holder") == "t"
        assert ticket_count(payment) == 2
        assert buyer_ticket_count(payment) == 0
        assert unassigned_ticket_count(payment) == 2

        # A resend after a refund neither restores the payment nor its tickets.
        payment = create_payment("cs_refunded")
        fulfill("cs_refunded")
        sql(f"""UPDATE public.user_event_payments SET payment_status = 'refunded' WHERE id = '{payment}';
                DELETE FROM public.event_tickets WHERE payment_id = '{payment}';""")
        assert fulfill("cs_refunded") == "f"
        assert status(payment) == "refunded"
        assert ticket_count(payment) == 0

        # A failure part way through rolls back, so the retry still fulfills.
        payment = create_payment("cs_no_tier", pricing="NULL")
        result = fulfill("cs_no_tier", check=False)
        assert result.returncode != 0 and "Pricing tier not found" in result.stderr, result.stderr
        assert status(payment) == "processing"
        assert ticket_count(payment) == 0
        sql(f"UPDATE public.user_event_payments SET pricing_id = '{TIER}' WHERE id = '{payment}';")
        assert fulfill("cs_no_tier") == "t"
        assert ticket_count(payment) == 2
        assert buyer_ticket_count(payment) == 1

        # A row the previous webhook code left paid without tickets is repaired.
        payment = create_payment("cs_paid_no_tickets", status="paid")
        assert fulfill("cs_paid_no_tickets") == "t"
        assert ticket_count(payment) == 2
        assert buyer_ticket_count(payment) == 1

        # A new session on the same payment row is a new purchase.
        payment = create_payment("cs_first")
        fulfill("cs_first")
        sql(f"""UPDATE public.user_event_payments SET stripe_session_id = 'cs_second',
                payment_status = 'processing' WHERE id = '{payment}';""")
        assert fulfill("cs_second") == "t"
        assert ticket_count(payment) == 4
        assert buyer_ticket_count(payment) == 1

        # An unknown session returns no row, which the route treats as a failure.
        assert fulfill("cs_unknown") == ""
        print("PASS: redelivery, concurrency, buyer assignment, refund resend, rollback, repair, repurchase, and denied roles")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
