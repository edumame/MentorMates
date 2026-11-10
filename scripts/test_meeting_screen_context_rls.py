#!/usr/bin/env python3
"""Test the meeting_screen_context lockdown migration in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
"""
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1] / "supabase/migrations"
TABLE_MIGRATION = ROOT / "20260116_meeting_screen_context_table.sql"
MIGRATION = ROOT / "202611090302_lock_meeting_screen_context.sql"
CONTAINER = "mentormates-screen-context-test-" + uuid.uuid4().hex[:12]
READ = "SELECT count(*) FROM public.meeting_screen_context;"
INSERT = "INSERT INTO public.meeting_screen_context (meeting_id, summary) VALUES ('{}', 'test');"


def docker(*args, input=None, check=True, timeout=90):
    result = subprocess.run(["docker", *args], input=input, text=True,
                            capture_output=True, check=False, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f"Disposable Docker command failed: {result.stderr or result.stdout}")
    return result


def sql(statement, check=True):
    return docker("exec", "-i", CONTAINER, "psql", "-X", "-h", "127.0.0.1", "-U", "postgres",
                  "-v", "ON_ERROR_STOP=1", "-Atq", input=statement, check=check)


def as_authenticated(statement, check=True):
    return sql(f"SET ROLE authenticated; {statement}", check=check)


def main():
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
        sql("""
            CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
            CREATE SCHEMA auth;
            CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
            GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
            GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
        """)
        sql(TABLE_MIGRATION.read_text())
        sql("GRANT ALL ON public.meeting_screen_context TO anon, authenticated, service_role;")
        # Confirm the client policies are in effect before the migration runs.
        as_authenticated(INSERT.format("before"))
        assert as_authenticated(READ).stdout.strip() == "1"

        migration = MIGRATION.read_text()
        sql(migration)
        sql(migration)  # must be re-runnable

        assert as_authenticated(READ).stdout.strip() == "0", "Signed-in users must not read screen summaries"
        denied = as_authenticated(INSERT.format("after"), check=False)
        assert denied.returncode != 0 and "row-level security" in denied.stderr, denied.stderr
        sql(f"SET ROLE service_role; {INSERT.format('service')}")
        assert sql(f"SET ROLE service_role; {READ}").stdout.strip() == "2", "Service role must keep access"
        print("PASS: clients locked out, migration re-runnable, service role unaffected")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
