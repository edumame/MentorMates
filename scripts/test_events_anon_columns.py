#!/usr/bin/env python3
"""Test the anon events column grants in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
"""
from pathlib import Path
import subprocess
import time
import uuid

MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/202611050004_restrict_anon_events_columns.sql"
CONTAINER = "mentormates-events-anon-test-" + uuid.uuid4().hex[:12]
PRIVATE_COLUMNS = ("paywall_content", "submitter_email", "submitter_name", "organizer_affiliation")
SCHEMA = """
CREATE TABLE public.events (
  event_id uuid PRIMARY KEY,
  event_name text,
  "Odd Column" text,
  paywall_content text,
  submitter_email text,
  submitter_name text,
  organizer_affiliation text
);
INSERT INTO public.events VALUES (gen_random_uuid(), 'Event', 'odd', 'secret', 'a@example.com', 'A', 'Uni');
GRANT ALL ON TABLE public.events TO anon, authenticated, service_role;
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


def assert_grants():
    assert sql('SET ROLE anon; SELECT event_name, "Odd Column" FROM public.events;').stdout.strip() == "Event|odd"
    for statement in ["SELECT * FROM public.events;"] + [
        f"SELECT {column} FROM public.events;" for column in PRIVATE_COLUMNS
    ] + [f"SELECT 1 FROM public.events WHERE {column} IS NOT NULL;" for column in PRIVATE_COLUMNS]:
        result = sql(f"SET ROLE anon; {statement}", check=False)
        assert result.returncode != 0 and "permission denied" in result.stderr, (statement, result.stderr)
    for role in ("authenticated", "service_role"):
        assert sql(f"SET ROLE {role}; SELECT paywall_content FROM public.events;").stdout.strip() == "secret", role


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
        # With no events table yet the migration must be a no-op, not an error.
        sql("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;")
        sql(migration)
        sql(SCHEMA)
        assert sql("SET ROLE anon; SELECT paywall_content FROM public.events;").stdout.strip() == "secret"
        sql(migration)
        assert_grants()
        # A re-run must leave the same grants in place.
        sql(migration)
        assert_grants()
        print("PASS: anon cannot read or filter on private events columns; other roles are unchanged")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
