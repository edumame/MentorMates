#!/usr/bin/env python3
"""Test the archived-event read policy in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
The schema below is a stub of the parts of public.events the policy depends on.
"""
from pathlib import Path
import subprocess
import time
import uuid

MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/202611050043_event_role_holders_view_archived_events.sql"
CONTAINER = "mentormates-archived-rls-test-" + uuid.uuid4().hex[:12]

OWNER = str(uuid.uuid4())
ORGANIZER = str(uuid.uuid4())
PARTICIPANT = str(uuid.uuid4())
STRANGER = str(uuid.uuid4())
ARCHIVED = str(uuid.uuid4())
OTHER_ARCHIVED = str(uuid.uuid4())
PUBLIC = str(uuid.uuid4())

SCHEMA = f"""
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
CREATE TYPE event_visibility AS ENUM ('test', 'demo', 'private', 'public', 'draft', 'archived');
CREATE TABLE public.events (
  event_id uuid PRIMARY KEY,
  owner_id uuid,
  visibility event_visibility NOT NULL
);
CREATE TABLE public.user_event_roles (event_id uuid NOT NULL, user_id uuid NOT NULL);
CREATE FUNCTION public.user_has_event_role(p_event_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_event_roles
                    WHERE event_id = p_event_id AND user_id = p_user_id) $$;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "existing visibility policy" ON public.events FOR SELECT
  USING (visibility IN ('public', 'private'));
GRANT SELECT ON public.events TO anon, authenticated;
INSERT INTO public.events VALUES
  ('{ARCHIVED}', '{OWNER}', 'archived'),
  ('{OTHER_ARCHIVED}', '{STRANGER}', 'archived'),
  ('{PUBLIC}', '{STRANGER}', 'public');
INSERT INTO public.user_event_roles VALUES
  ('{ARCHIVED}', '{ORGANIZER}'),
  ('{ARCHIVED}', '{PARTICIPANT}');
"""


def docker(*args, input=None, check=True, timeout=90):
    result = subprocess.run(["docker", *args], input=input, text=True,
                            capture_output=True, check=False, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f"Disposable Docker command failed: {result.stderr or result.stdout}")
    return result


def sql(statement):
    return docker("exec", "-i", CONTAINER, "psql", "-X", "-h", "127.0.0.1", "-U", "postgres",
                  "-v", "ON_ERROR_STOP=1", "-Atq", input=statement)


def visible_events(role, user=""):
    output = sql(f"SET test.uid = '{user}'; SET ROLE {role}; SELECT event_id FROM public.events;").stdout
    return set(output.split())


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
        sql(SCHEMA)
        assert visible_events("authenticated", ORGANIZER) == {PUBLIC}, "Precondition: archived rows start hidden"
        sql(migration)
        sql(migration)  # Must be safe to re-run.
        for user in (OWNER, ORGANIZER, PARTICIPANT):
            assert visible_events("authenticated", user) == {PUBLIC, ARCHIVED}, user
        assert visible_events("authenticated", STRANGER) == {PUBLIC, OTHER_ARCHIVED}, "Owners see only their own"
        assert visible_events("authenticated", str(uuid.uuid4())) == {PUBLIC}, "Unrelated users must not see archived events"
        assert visible_events("anon") == {PUBLIC}, "Signed-out visitors must not see archived events"
        print("PASS: archived events are readable by their owners and role holders only, and the migration re-runs")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
