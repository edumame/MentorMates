#!/usr/bin/env python3
"""Test event and mentor-slot capacity limits in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Applies the real migrations on top of a minimal stub of the Supabase schema.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import threading
import time
import uuid

MIGRATIONS = Path(__file__).resolve().parents[1] / "supabase/migrations"
ORIGINAL_TRIGGER = MIGRATIONS / "20250818_enforce_participant_capacity_trigger.sql"
MENTOR_BOOKING = MIGRATIONS / "20260413_mentor_booking.sql"
MIGRATION = MIGRATIONS / "202611050117_serialize_capacity_checks.sql"
CONTAINER = "mentormates-capacity-test-" + uuid.uuid4().hex[:12]
EVENT_FULL = "Event is full"
SLOT_FULL = "Slot is fully booked"

# The events table has no UPDATE policy on purpose. A trigger that took its lock
# with the caller's rights would then read no row and skip the limit.
STUB_SCHEMA = """
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TYPE public.event_role AS ENUM ('participant', 'mentor', 'judge', 'organizer', 'admin');
CREATE TABLE public.user_profiles (uid uuid PRIMARY KEY);
CREATE TABLE public.events (event_id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE public.events ADD COLUMN participant_capacity integer;
CREATE TABLE public.user_event_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  role public.event_role NOT NULL,
  UNIQUE (user_id, event_id)
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_event_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_read ON public.events FOR SELECT USING (true);
CREATE POLICY roles_read ON public.user_event_roles FOR SELECT USING (true);
CREATE POLICY roles_join ON public.user_event_roles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY roles_update ON public.user_event_roles FOR UPDATE USING (user_id = auth.uid());
CREATE FUNCTION public.is_admin_user(user_id uuid) RETURNS boolean LANGUAGE sql AS 'SELECT false';
"""
GRANTS = """
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
"""


def docker(*args, input=None, check=True, timeout=90):
    result = subprocess.run(["docker", *args], input=input, text=True,
                            capture_output=True, check=False, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f"Disposable Docker command failed: {result.stderr or result.stdout}")
    return result


def sql(statement, check=True, database="postgres"):
    return docker("exec", "-i", CONTAINER, "psql", "-X", "-h", "127.0.0.1", "-U", "postgres",
                  "-d", database, "-v", "ON_ERROR_STOP=1", "-Atq", input=statement, check=check)


def scalar(statement):
    return sql(statement).stdout.strip()


def as_user(user, statement, tail="COMMIT;"):
    """Run a statement in one transaction with the rights of a signed-in user."""
    return sql("BEGIN; SET LOCAL ROLE authenticated; "
               f"SELECT set_config('request.jwt.claim.sub', '{user}', true); {statement} {tail}",
               check=False)


def new_user():
    user = str(uuid.uuid4())
    sql(f"INSERT INTO public.user_profiles VALUES ('{user}');")
    return user


def new_event(capacity="NULL"):
    return scalar(f"INSERT INTO public.events (participant_capacity) VALUES ({capacity}) RETURNING event_id;")


def join(user, event, role="participant"):
    return f"INSERT INTO public.user_event_roles (user_id, event_id, role) VALUES ('{user}', '{event}', '{role}');"


def participants(event):
    return int(scalar("SELECT count(*) FROM public.user_event_roles "
                      f"WHERE event_id = '{event}' AND role = 'participant';"))


def new_slot(event, max_bookings):
    mentor = new_user()
    return scalar("INSERT INTO public.mentor_availability (mentor_id, event_id, start_time, end_time, max_bookings) "
                  f"VALUES ('{mentor}', '{event}', now(), now() + interval '1 hour', {max_bookings}) RETURNING id;")


def new_member(event):
    user = new_user()
    sql(join(user, event))
    return user


def book(user, slot):
    return f"INSERT INTO public.mentor_bookings (availability_id, participant_id) VALUES ('{slot}', '{user}');"


def set_status(user, slot, status):
    return (f"UPDATE public.mentor_bookings SET status = '{status}' "
            f"WHERE availability_id = '{slot}' AND participant_id = '{user}';")


def confirmed(slot):
    return int(scalar("SELECT count(*) FROM public.mentor_bookings "
                      f"WHERE availability_id = '{slot}' AND status = 'confirmed';"))


def assert_ok(result):
    assert result.returncode == 0, result.stderr


def assert_rejected(result, message):
    assert result.returncode != 0 and message in result.stderr, result.stderr


def race(attempts, message):
    """Run attempts in independent sessions and return how many succeeded."""
    with ThreadPoolExecutor(max_workers=len(attempts)) as pool:
        results = list(pool.map(lambda attempt: attempt(), attempts))
    for result in results:
        if result.returncode:
            assert message in result.stderr, result.stderr
    return sum(result.returncode == 0 for result in results)


def test_event_capacity():
    event = new_event(5)
    users = [new_user() for _ in range(30)]
    attempts = [lambda user=user: as_user(user, join(user, event)) for user in users]
    assert race(attempts, EVENT_FULL) == 5
    assert participants(event) == 5

    # Two writers in flight at once: both pass a count that ignores the other.
    event = new_event(1)
    first, second = new_user(), new_user()
    holder = threading.Thread(target=lambda: as_user(first, join(first, event), "SELECT pg_sleep(1.5); COMMIT;"))
    holder.start()
    time.sleep(0.5)
    assert_rejected(as_user(second, join(second, event)), EVENT_FULL)
    holder.join()
    assert participants(event) == 1

    # A rolled-back join frees its seat for the writer queued behind it.
    event = new_event(1)
    first, second = new_user(), new_user()
    holder = threading.Thread(target=lambda: as_user(first, join(first, event), "SELECT pg_sleep(1.5); ROLLBACK;"))
    holder.start()
    time.sleep(0.5)
    assert_ok(as_user(second, join(second, event)))
    holder.join()
    assert participants(event) == 1

    # Only participants count, and only participants are limited.
    event = new_event(1)
    first = new_user()
    assert_ok(as_user(first, join(first, event)))
    mentor = new_user()
    assert_ok(as_user(mentor, join(mentor, event, "mentor")))
    assert_rejected(as_user(mentor, f"UPDATE public.user_event_roles SET role = 'participant' WHERE user_id = '{mentor}';"),
                    EVENT_FULL)

    # Uncapped events stay open.
    event = new_event()
    users = [new_user() for _ in range(10)]
    attempts = [lambda user=user: as_user(user, join(user, event)) for user in users]
    assert race(attempts, EVENT_FULL) == 10


def test_mentor_slot_capacity():
    event = new_event()
    for max_bookings in (1, 3):
        slot = new_slot(event, max_bookings)
        users = [new_member(event) for _ in range(30)]
        attempts = [lambda user=user: as_user(user, book(user, slot)) for user in users]
        assert race(attempts, SLOT_FULL) == max_bookings
        assert confirmed(slot) == max_bookings

    # Two writers in flight at once on a 1:1 slot.
    slot = new_slot(event, 1)
    first, second = new_member(event), new_member(event)
    holder = threading.Thread(target=lambda: as_user(first, book(first, slot), "SELECT pg_sleep(1.5); COMMIT;"))
    holder.start()
    time.sleep(0.5)
    assert_rejected(as_user(second, book(second, slot)), SLOT_FULL)
    holder.join()
    assert confirmed(slot) == 1

    # A full slot rejects a direct user insert and a service-role write alike.
    outsider = new_member(event)
    assert_rejected(as_user(outsider, book(outsider, slot)), SLOT_FULL)
    assert_rejected(sql(f"SET ROLE service_role; {book(outsider, slot)}", check=False), SLOT_FULL)

    # A cancelled booking frees its place, and flipping it back is limited too.
    assert_ok(as_user(first, set_status(first, slot, "cancelled")))
    assert_ok(as_user(outsider, book(outsider, slot)))
    assert_rejected(as_user(first, set_status(first, slot, "confirmed")), SLOT_FULL)
    assert confirmed(slot) == 1

    # A cancelled row can be inserted on a full slot: it takes no place.
    late = new_member(event)
    assert_ok(as_user(late, "INSERT INTO public.mentor_bookings (availability_id, participant_id, status) "
                            f"VALUES ('{slot}', '{late}', 'cancelled');"))

    # Moving a booking onto a full slot is limited.
    other = new_slot(event, 1)
    mover = new_member(event)
    assert_ok(as_user(mover, book(mover, other)))
    assert_rejected(as_user(mover, f"UPDATE public.mentor_bookings SET availability_id = '{slot}' "
                                   f"WHERE participant_id = '{mover}';"), SLOT_FULL)

    # A slot already overbooked by the old race can still be saved and drained.
    overbooked = new_slot(event, 1)
    first, second = new_member(event), new_member(event)
    sql("ALTER TABLE public.mentor_bookings DISABLE TRIGGER trg_enforce_mentor_booking_capacity;")
    sql(book(first, overbooked) + book(second, overbooked))
    sql("ALTER TABLE public.mentor_bookings ENABLE TRIGGER trg_enforce_mentor_booking_capacity;")
    assert_ok(as_user(first, set_status(first, overbooked, "confirmed")))
    assert_ok(as_user(first, set_status(first, overbooked, "cancelled")))
    assert confirmed(overbooked) == 1


def test_applies_without_mentor_tables():
    sql("CREATE DATABASE no_mentor_tables;")
    sql(STUB_SCHEMA, database="no_mentor_tables")
    sql(MIGRATION.read_text(), database="no_mentor_tables")
    triggers = sql("SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'trg_enforce_%';",
                   database="no_mentor_tables").stdout.strip()
    assert triggers == "2", triggers


def main():
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
        sql(STUB_SCHEMA)
        sql(ORIGINAL_TRIGGER.read_text())
        sql(MENTOR_BOOKING.read_text())
        sql(GRANTS)
        # Twice, because the migration must be safe to re-run.
        sql(MIGRATION.read_text())
        sql(MIGRATION.read_text())
        test_event_capacity()
        test_mentor_slot_capacity()
        test_applies_without_mentor_tables()
        print("PASS: capacity limits hold under concurrency for events and mentor slots")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
