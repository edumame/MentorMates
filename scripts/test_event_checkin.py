#!/usr/bin/env python3
"""Test the actual event check-in migration in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Run from repository root.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import time
import uuid

from test_scraper_quota import CONTAINER, docker, sql

MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/202611110101_record_event_checkins.sql"

# Only the columns the migration touches, from the repo's table definitions.
SCHEMA = """
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TYPE ticket_status_enum AS ENUM ('unassigned', 'assigned', 'used', 'transferred');
CREATE TABLE public.events (event_id uuid PRIMARY KEY);
CREATE TABLE public.user_profiles (uid uuid PRIMARY KEY);
CREATE TABLE public.user_event_roles (
  user_id uuid NOT NULL REFERENCES public.user_profiles(uid),
  event_id uuid NOT NULL REFERENCES public.events(event_id),
  UNIQUE (user_id, event_id)
);
CREATE TABLE public.event_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(event_id),
  assigned_to_user_id uuid REFERENCES public.user_profiles(uid),
  ticket_status ticket_status_enum DEFAULT 'unassigned',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
"""


def new_id(table, column):
    value = str(uuid.uuid4())
    sql(f"INSERT INTO public.{table} ({column}) VALUES ('{value}');")
    return value


def register(event, user):
    sql(f"INSERT INTO public.user_event_roles (user_id, event_id) VALUES ('{user}', '{event}');")


def add_ticket(event, user, status="assigned"):
    return sql(f"INSERT INTO public.event_tickets (event_id, assigned_to_user_id, ticket_status) "
               f"VALUES ('{event}', '{user}', '{status}') RETURNING id;").stdout.strip()


def ticket_status(ticket):
    return sql(f"SELECT ticket_status FROM public.event_tickets WHERE id='{ticket}';").stdout.strip()


def check_in(event, user, staff):
    return sql(f"SET ROLE service_role; SELECT outcome FROM public.record_event_checkin('{event}', '{user}', '{staff}');").stdout.splitlines()[-1]


def main():
    migration = MIGRATION.read_text()
    # Pull separately: a cold CI runner may need considerably longer than a SQL call.
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
        sql(migration)
        sql(migration)  # Production history is empty, so a re-run must be safe.

        event = new_id("events", "event_id")
        other_event = new_id("events", "event_id")
        staff = new_id("user_profiles", "uid")
        attendee = new_id("user_profiles", "uid")
        register(event, attendee)
        ticket = add_ticket(event, attendee)
        spare_ticket = add_ticket(event, attendee)
        other_ticket = add_ticket(other_event, attendee)

        for role in ("anon", "authenticated"):
            for statement in (
                f"SELECT * FROM public.record_event_checkin('{event}', '{attendee}', '{attendee}');",
                "SELECT * FROM public.event_checkins;",
                f"INSERT INTO public.event_checkins (event_id, user_id) VALUES ('{event}', '{attendee}');",
                "UPDATE public.event_checkins SET checked_in_by = NULL;",
                "DELETE FROM public.event_checkins;",
            ):
                result = sql(f"SET ROLE {role}; {statement}", check=False)
                assert result.returncode != 0 and "permission denied" in result.stderr, (role, statement, result.stderr)

        stranger = new_id("user_profiles", "uid")
        assert check_in(event, stranger, staff) == "not_registered"
        assert sql(f"SELECT count(*) FROM public.event_checkins WHERE user_id='{stranger}';").stdout.strip() == "0"

        assert check_in(event, attendee, staff) == "checked_in"
        statuses = sorted([ticket_status(ticket), ticket_status(spare_ticket)])
        assert statuses == ["assigned", "used"], statuses
        assert ticket_status(other_ticket) == "assigned", "Another event's ticket must be untouched"
        first_scan = sql(f"SELECT checked_in_at, checked_in_by FROM public.event_checkins WHERE user_id='{attendee}';").stdout.strip()
        assert first_scan.endswith(staff), first_scan

        assert check_in(event, attendee, str(uuid.uuid4())) == "already_checked_in"
        assert sorted([ticket_status(ticket), ticket_status(spare_ticket)]) == ["assigned", "used"], \
            "A repeat scan must not use another ticket"
        assert sql(f"SELECT checked_in_at, checked_in_by FROM public.event_checkins WHERE user_id='{attendee}';").stdout.strip() == first_scan

        # A free-event attendee has no ticket and must still be recorded.
        free_attendee = new_id("user_profiles", "uid")
        register(event, free_attendee)
        assert check_in(event, free_attendee, staff) == "checked_in"

        # An unassigned ticket bought for someone else is not this attendee's entry.
        buyer = new_id("user_profiles", "uid")
        register(event, buyer)
        unassigned = add_ticket(event, buyer, "unassigned")
        assert check_in(event, buyer, staff) == "checked_in"
        assert ticket_status(unassigned) == "unassigned"

        null_result = sql(f"SET ROLE service_role; SELECT * FROM public.record_event_checkin('{event}', '{attendee}', NULL);", check=False)
        assert null_result.returncode != 0 and "are required" in null_result.stderr

        # Twenty independent sessions scan the same QR at the same moment.
        racer = new_id("user_profiles", "uid")
        register(event, racer)
        racer_ticket = add_ticket(event, racer)
        with ThreadPoolExecutor(max_workers=20) as pool:
            results = list(pool.map(lambda _: check_in(event, racer, staff), range(20)))
        assert results.count("checked_in") == 1, results
        assert results.count("already_checked_in") == 19, results
        assert ticket_status(racer_ticket) == "used"
        print("PASS: first scan recorded, repeats flagged, tickets marked once, concurrency, and denied roles")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
