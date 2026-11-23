"""Paid-event seat holds in disposable PostgreSQL. Never takes a database URL.

Applies the real checkout-attempt and seat-hold migrations and checks that an
approval holds a seat, a full event refuses approval (also under two
concurrent approvals), only a full refund releases the hold, and the backfill
closes refunds made before the migration.
"""
from concurrent.futures import ThreadPoolExecutor
import time

from rls_test_harness import Database, Checks

EVENT = '00000000-0000-0000-0000-0000000000e1'
FREE_EVENT = '00000000-0000-0000-0000-0000000000e2'
TIER = '00000000-0000-0000-0000-0000000000f1'
ALICE, BOB, CAROL, DAVE = (f'00000000-0000-0000-0000-00000000000{n}' for n in range(1, 5))

SCHEMA = '''
CREATE ROLE service_role NOLOGIN;
CREATE TYPE event_role AS ENUM ('participant','mentor','judge','organizer','admin');
CREATE TYPE participant_request_status AS ENUM ('pending','approved','rejected','withdrawn');
CREATE TYPE payment_status AS ENUM ('processing','paid','canceled','refunded');
CREATE TABLE events(event_id uuid PRIMARY KEY, paid boolean NOT NULL DEFAULT false, participant_capacity integer);
CREATE TABLE participant_approval_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL,
  user_id uuid NOT NULL, requested_role event_role NOT NULL DEFAULT 'participant',
  status participant_request_status NOT NULL DEFAULT 'pending', updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id,user_id,requested_role));
CREATE TABLE user_event_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, user_id uuid, role event_role,
  UNIQUE(user_id,event_id));
CREATE TABLE user_event_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,event_id uuid,
  stripe_customer_id text,stripe_session_id text,stripe_payment_intent_id text,pricing_id uuid,
  payment_status payment_status,amount_paid integer,currency text DEFAULT 'usd',updated_at timestamptz,
  UNIQUE(user_id,event_id));
CREATE TABLE pricing_tiers(id uuid PRIMARY KEY,event_id uuid,bundle_size integer,is_active boolean);
CREATE TABLE event_tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid,payment_id uuid,
  purchased_by_user_id uuid,ticket_status text,assigned_to_user_id uuid,assigned_at timestamptz);
'''


def main():
    checks = Checks()
    with Database('paid-seat-holds') as db:
        def approve(user, event=EVENT):
            ok, out = db.attempt(
                'postgres', None,
                f"UPDATE participant_approval_requests SET status='approved' "
                f"WHERE event_id='{event}' AND user_id='{user}'",
            )
            return 'approved' if ok else ('full' if 'Event is full' in out else out)

        def status(user, event=EVENT):
            return db.sql(
                f"SELECT status FROM participant_approval_requests WHERE event_id='{event}' AND user_id='{user}'"
            )

        def held(exclude='NULL'):
            return db.sql(f"SELECT held_participant_seats('{EVENT}', {exclude})")

        def pay(user, session, intent):
            db.sql(f"SELECT register_event_checkout('{user}','{EVENT}','{TIER}','cus_{session}','{session}')")
            db.sql(f"SELECT apply_event_checkout('{session}','{intent}','paid',1000,'usd')")

        def reset(capacity):
            db.sql(f"UPDATE participant_approval_requests SET status='pending'; "
                   f"UPDATE events SET participant_capacity={capacity} WHERE event_id='{EVENT}'")

        db.sql(SCHEMA)
        db.sql(f"INSERT INTO events VALUES ('{EVENT}', true, 2), ('{FREE_EVENT}', false, 1);"
               f"INSERT INTO pricing_tiers VALUES ('{TIER}','{EVENT}',1,true);")
        for user in (ALICE, BOB, CAROL, DAVE):
            db.sql(f"INSERT INTO participant_approval_requests(event_id,user_id) VALUES ('{EVENT}','{user}'),('{FREE_EVENT}','{user}')")
        db.migrate('202611060301_checkout_attempts.sql')

        # Backfill: a refund made before the migration left Alice approved.
        # Bob paid, Carol was refunded but has a mentor role: both untouched.
        db.sql(f"UPDATE participant_approval_requests SET status='approved' WHERE event_id='{EVENT}' AND user_id IN ('{ALICE}','{BOB}','{CAROL}');"
               f"INSERT INTO user_event_payments(user_id,event_id,payment_status) VALUES "
               f"('{ALICE}','{EVENT}','refunded'),('{BOB}','{EVENT}','paid'),('{CAROL}','{EVENT}','refunded');"
               f"INSERT INTO user_event_roles(event_id,user_id,role) VALUES ('{EVENT}','{CAROL}','mentor');")
        db.migrate('202611110301_hold_paid_participant_seats.sql')
        checks.expect('backfill withdraws a refunded approval', status(ALICE), 'withdrawn')
        checks.expect('backfill keeps a paid approval', status(BOB), 'approved')
        checks.expect('backfill keeps a user who holds another role', status(CAROL), 'approved')
        db.sql("DELETE FROM user_event_roles; DELETE FROM user_event_payments;")

        reset(2)
        checks.expect('first approval holds a seat', approve(ALICE), 'approved')
        checks.expect('second approval holds a seat', approve(BOB), 'approved')
        checks.expect('two seats held', held(), '2')
        checks.expect('approval past capacity is refused', approve(CAROL), 'full')
        checks.expect('refused request stays pending', status(CAROL), 'pending')
        checks.expect('checkout seat check: full for a new user', db.sql(f"SELECT held_participant_seats('{EVENT}','{CAROL}') >= 2"), 't')
        checks.expect('checkout seat check: own hold still payable', db.sql(f"SELECT held_participant_seats('{EVENT}','{ALICE}') >= 2"), 'f')

        pay(ALICE, 'cs_a1', 'pi_a1')
        pay(BOB, 'cs_b1', 'pi_b1')
        pay(BOB, 'cs_b2', 'pi_b2')
        db.sql("SELECT apply_event_checkout(NULL,'pi_b1','refunded')")
        checks.expect('refunding one of two paid checkouts keeps the payment paid',
                      db.sql(f"SELECT payment_status FROM user_event_payments WHERE user_id='{BOB}'"), 'paid')
        checks.expect('refunding one of two paid checkouts keeps the hold', status(BOB), 'approved')
        db.sql("SELECT apply_event_checkout('cs_a1',NULL,'canceled')")
        checks.expect('late expiry of a paid checkout keeps the hold', status(ALICE), 'approved')
        db.sql("SELECT apply_event_checkout(NULL,'pi_a1','refunded')")
        checks.expect('full refund releases the hold', status(ALICE), 'withdrawn')
        checks.expect('released seat can be approved again', approve(CAROL), 'approved')

        db.sql(f"UPDATE participant_approval_requests SET status='rejected' WHERE event_id='{EVENT}' AND user_id='{CAROL}'")
        checks.expect('organizer removal frees the hold', approve(DAVE), 'approved')
        db.sql(f"UPDATE participant_approval_requests SET status='withdrawn' WHERE event_id='{EVENT}' AND user_id='{DAVE}'")
        checks.expect('withdrawal frees the hold', held(), '1')

        db.sql(f"INSERT INTO user_event_roles(event_id,user_id,role) VALUES ('{EVENT}','{BOB}','participant')")
        checks.expect('a joined user is counted once', held(), '1')
        checks.expect('re-saving an approved request is not re-checked',
                      db.attempt('postgres', None, f"UPDATE participant_approval_requests SET updated_at=now() WHERE event_id='{EVENT}' AND user_id='{BOB}'")[0], True)
        checks.expect('free events are left to the role capacity trigger', approve(ALICE, FREE_EVENT), 'approved')
        checks.expect('free events: second approval not blocked here', approve(BOB, FREE_EVENT), 'approved')

        # Two organizers approve the last seat at the same moment.
        db.sql("DELETE FROM user_event_roles;")
        reset(1)

        def slow_approve(user, delay):
            time.sleep(delay)
            return db._psql(
                "BEGIN;\n"
                f"UPDATE participant_approval_requests SET status='approved' WHERE event_id='{EVENT}' AND user_id='{user}';\n"
                "SELECT pg_sleep(1);\n"
                "COMMIT;\n"
            ).returncode == 0

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda args: slow_approve(*args), [(ALICE, 0), (BOB, 0.3)]))
        checks.expect('exactly one concurrent approval wins', sorted(results), [False, True])
        checks.expect('capacity never exceeded under concurrent approvals',
                      db.sql(f"SELECT count(*) FROM participant_approval_requests WHERE event_id='{EVENT}' AND status='approved'"), '1')

        for fn in ('held_participant_seats(uuid,uuid)', 'enforce_paid_participant_seat_hold()',
                   'release_refunded_seat_reservation()'):
            checks.expect(f'authenticated cannot execute {fn}',
                          db.sql(f"SELECT has_function_privilege('authenticated','public.{fn}','execute')"), 'f')
    checks.finish()


if __name__ == '__main__':
    main()
