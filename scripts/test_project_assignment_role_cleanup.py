#!/usr/bin/env python3
"""Test the project assignment role cleanup migration in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Run from repository root.
"""
from pathlib import Path
import subprocess
import time
import uuid

MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/202611050066_cleanup_project_assignments_on_role_change.sql"
CONTAINER = "mentormates-assignment-test-" + uuid.uuid4().hex[:12]

SCHEMA = """
CREATE ROLE authenticated NOLOGIN;
CREATE TYPE public.event_role AS ENUM ('participant', 'mentor', 'judge', 'organizer', 'admin', 'event');

CREATE TABLE public.user_event_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  role public.event_role NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE TABLE public.project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  role public.event_role NOT NULL,
  CONSTRAINT uq_project_assignment UNIQUE (event_id, project_id, user_id, role),
  CONSTRAINT valid_assignment_role CHECK (role IN ('judge', 'mentor'))
);

-- No policy for authenticated: like a global admin with no event role row, the
-- session client cannot see these rows, so cleanup must not depend on the caller.
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.user_event_roles TO authenticated;

CREATE FUNCTION public.uid(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;

CREATE FUNCTION public.seed(n int, event_n int, current_role_name text, VARIADIC assigned text[]) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  assigned_role text;
BEGIN
  IF current_role_name IS NOT NULL THEN
    INSERT INTO public.user_event_roles (user_id, event_id, role)
    VALUES (public.uid(n), public.uid(event_n), current_role_name::public.event_role);
  END IF;
  FOREACH assigned_role IN ARRAY assigned LOOP
    INSERT INTO public.project_assignments (project_id, user_id, event_id, role)
    VALUES (public.uid(500), public.uid(n), public.uid(event_n), assigned_role::public.event_role);
  END LOOP;
END;
$$;

CREATE FUNCTION public.expect(n int, event_n int, expected text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  actual text;
BEGIN
  SELECT coalesce(string_agg(role::text, ',' ORDER BY role::text), '') INTO actual
  FROM public.project_assignments
  WHERE user_id = public.uid(n) AND event_id = public.uid(event_n);
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'user % event %: expected assignments [%], got [%]', n, event_n, expected, actual;
  END IF;
END;
$$;
"""

# Users 1-10 hold valid assignments; users 11-14 are in the state the bug left behind.
SEED = """
SELECT public.seed(1, 900, 'judge', 'judge');
SELECT public.seed(2, 900, 'judge', 'judge');
SELECT public.seed(3, 900, 'judge', 'judge');
SELECT public.seed(4, 900, 'judge', 'judge');
SELECT public.seed(5, 900, 'mentor', 'mentor');
SELECT public.seed(6, 900, 'organizer', 'judge', 'mentor');
SELECT public.seed(7, 900, 'judge', 'judge');
SELECT public.seed(8, 900, 'judge', 'judge');
SELECT public.seed(9, 900, 'judge', 'judge');
SELECT public.seed(9, 901, 'judge', 'judge');
SELECT public.seed(10, 900, 'mentor', 'mentor');
SELECT public.seed(11, 900, NULL, 'judge');
SELECT public.seed(12, 900, 'participant', 'judge');
SELECT public.seed(13, 900, 'mentor', 'judge', 'mentor');
SELECT public.seed(14, 900, 'admin', 'judge', 'mentor');
"""

# Applied once with the assignments table hidden, to prove a missing table is skipped.
HIDE_ASSIGNMENTS = "ALTER TABLE public.project_assignments RENAME TO project_assignments_hidden;"
SHOW_ASSIGNMENTS = "ALTER TABLE public.project_assignments_hidden RENAME TO project_assignments;"
ASSERT_NO_TRIGGER = """
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'user_event_roles_project_assignment_cleanup_trigger') THEN
    RAISE EXCEPTION 'trigger must not be created when project_assignments is missing';
  END IF;
END;
$$;
"""

SCENARIO = """
-- Existing stale rows are removed, and valid ones survive.
SELECT public.expect(11, 900, '');
SELECT public.expect(12, 900, '');
SELECT public.expect(13, 900, 'mentor');
SELECT public.expect(14, 900, 'judge,mentor');
SELECT public.expect(1, 900, 'judge');
SELECT public.expect(6, 900, 'judge,mentor');

-- Role writes run as a caller who cannot touch project_assignments.
SET ROLE authenticated;
UPDATE public.user_event_roles SET role = 'participant' WHERE user_id = public.uid(1);
DELETE FROM public.user_event_roles WHERE user_id = public.uid(2);
UPDATE public.user_event_roles SET role = 'organizer' WHERE user_id = public.uid(3);
UPDATE public.user_event_roles SET role = 'admin' WHERE user_id = public.uid(4);
UPDATE public.user_event_roles SET role = 'judge' WHERE user_id = public.uid(5);
UPDATE public.user_event_roles SET role = 'judge' WHERE user_id = public.uid(6);
INSERT INTO public.user_event_roles (user_id, event_id, role)
VALUES (public.uid(7), public.uid(900), 'participant')
ON CONFLICT (user_id, event_id) DO UPDATE SET role = EXCLUDED.role;
UPDATE public.user_event_roles SET role = 'judge' WHERE user_id = public.uid(8);
DELETE FROM public.user_event_roles WHERE user_id = public.uid(9) AND event_id = public.uid(900);
UPDATE public.user_event_roles SET updated_at = now() WHERE user_id = public.uid(10);
RESET ROLE;

SELECT public.expect(1, 900, '');
SELECT public.expect(2, 900, '');
SELECT public.expect(3, 900, 'judge');
SELECT public.expect(4, 900, 'judge');
SELECT public.expect(5, 900, '');
SELECT public.expect(6, 900, 'judge');
SELECT public.expect(7, 900, '');
SELECT public.expect(8, 900, 'judge');
SELECT public.expect(9, 900, '');
SELECT public.expect(9, 901, 'judge');
SELECT public.expect(10, 900, 'mentor');
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
        for step in (SCHEMA, SEED, HIDE_ASSIGNMENTS, migration, ASSERT_NO_TRIGGER, SHOW_ASSIGNMENTS,
                     migration, migration, SCENARIO):
            sql(step)
        print("PASS: stale rows removed, role changes and removals clean up, organizer-level roles keep assignments")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
