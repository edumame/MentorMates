#!/usr/bin/env python3
"""Test the delete_event_and_related migration in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
The schema below is a minimal copy of the tables the function touches, keeping
the real foreign keys: event_tracks, feedback and platform_engagement do not
cascade from events.
"""
from pathlib import Path
import subprocess
import time
import uuid

MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/202611050006_delete_event_and_related.sql"
CONTAINER = "mentormates-event-delete-test-" + uuid.uuid4().hex[:12]

TARGET = "11111111-1111-4111-8111-111111111111"
OTHER = "22222222-2222-4222-8222-222222222222"
TABLES = ("event_tickets", "prize_winners", "prizes", "event_tracks", "platform_engagement",
          "feedback", "role_passwords", "user_event_roles", "events")

SCHEMA = """
CREATE TABLE public.events (event_id uuid PRIMARY KEY);
CREATE TABLE public.event_tracks (
  track_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(event_id));
CREATE TABLE public.prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid REFERENCES public.event_tracks(track_id) ON DELETE CASCADE);
CREATE TABLE public.prize_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_id uuid REFERENCES public.prizes(id) ON DELETE CASCADE);
CREATE TABLE public.event_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE);
CREATE TABLE public.platform_engagement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(event_id));
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(event_id));
CREATE TABLE public.role_passwords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE);
CREATE TABLE public.user_event_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE);
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


def seed(event_id):
    sql(f"""
    INSERT INTO public.events VALUES ('{event_id}');
    WITH t AS (INSERT INTO public.event_tracks (event_id) VALUES ('{event_id}') RETURNING track_id),
         p AS (INSERT INTO public.prizes (track_id) SELECT track_id FROM t RETURNING id)
    INSERT INTO public.prize_winners (prize_id) SELECT id FROM p;
    INSERT INTO public.event_tickets (event_id) VALUES ('{event_id}');
    INSERT INTO public.platform_engagement (event_id) VALUES ('{event_id}');
    INSERT INTO public.feedback (event_id) VALUES ('{event_id}');
    INSERT INTO public.role_passwords (event_id) VALUES ('{event_id}');
    INSERT INTO public.user_event_roles (event_id) VALUES ('{event_id}');
    """)


def counts():
    query = " UNION ALL ".join(f"SELECT '{table}', count(*) FROM public.{table}" for table in TABLES)
    rows = sql(query + ";").stdout.strip().splitlines()
    return {row.split("|")[0]: int(row.split("|")[1]) for row in rows}


def delete_event(event_id, check=True):
    return sql(f"SET ROLE service_role; SELECT public.delete_event_and_related('{event_id}');", check=check)


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
        for table in TABLES:
            # RLS with no policies: only the service role can see these rows.
            sql(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY; "
                f"GRANT ALL ON public.{table} TO service_role, authenticated;")
        sql(migration)
        sql(migration)  # Must be safe to re-apply.
        seed(TARGET)
        seed(OTHER)
        seeded = counts()
        assert all(count == 2 for count in seeded.values()), seeded

        for role in ("anon", "authenticated"):
            result = sql(f"SET ROLE {role}; SELECT public.delete_event_and_related('{TARGET}');", check=False)
            assert result.returncode != 0 and "permission denied" in result.stderr, (role, result.stderr)
        assert counts() == seeded, "Denied callers must not delete anything"

        # A reference the function does not know about makes the last delete
        # fail. Everything before it must roll back, not leave a gutted event.
        sql(f"""
        CREATE TABLE public.unknown_child (event_id uuid REFERENCES public.events(event_id));
        INSERT INTO public.unknown_child VALUES ('{TARGET}');
        """)
        failed = delete_event(TARGET, check=False)
        assert failed.returncode != 0 and "foreign key" in failed.stderr, failed.stderr
        assert counts() == seeded, "A failed delete must leave every row in place"
        sql("DROP TABLE public.unknown_child;")

        assert delete_event(TARGET).stdout.strip() == "t"
        remaining = counts()
        assert all(count == 1 for count in remaining.values()), remaining
        assert sql(f"SELECT count(*) FROM public.events WHERE event_id='{OTHER}';").stdout.strip() == "1"

        assert delete_event(TARGET).stdout.strip() == "f", "A missing event must report no delete"
        assert counts() == remaining
        print("PASS: full delete, rollback on failure, other events untouched, denied roles")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
