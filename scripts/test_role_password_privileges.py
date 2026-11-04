#!/usr/bin/env python3
"""Test role password privileges in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Run from repository root.
"""
from pathlib import Path
import subprocess
import time
import uuid

MIGRATIONS = Path(__file__).resolve().parents[1] / "supabase/migrations"
RLS_MIGRATION = MIGRATIONS / "20251028_role_password_rls.sql"
MIGRATION = MIGRATIONS / "202611050116_restrict_role_password_hash_reads.sql"
CONTAINER = "mentormates-role-password-test-" + uuid.uuid4().hex[:12]

EVENT = str(uuid.uuid4())
OTHER_EVENT = str(uuid.uuid4())
ORGANIZER = str(uuid.uuid4())
STRANGER = str(uuid.uuid4())

# Mirrors supabase/database_schema_dump_05262025.sql, including its GRANT ALL.
SCHEMA = f"""
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE public.events (event_id uuid PRIMARY KEY);
CREATE TABLE public.user_event_roles (event_id uuid, user_id uuid, role text);
CREATE FUNCTION public.is_event_organizer(p_event_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_event_roles
     WHERE event_id = p_event_id AND user_id = p_user_id AND role = 'organizer') $$;

CREATE TABLE public.role_passwords (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  role text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (event_id, role)
);
GRANT ALL ON TABLE public.role_passwords TO anon, authenticated, service_role;

INSERT INTO public.events VALUES ('{EVENT}'), ('{OTHER_EVENT}');
INSERT INTO public.user_event_roles VALUES ('{EVENT}', '{ORGANIZER}', 'organizer');
INSERT INTO public.role_passwords (event_id, role, password_hash) VALUES
  ('{EVENT}', 'judge', 'hash-judge'),
  ('{EVENT}', 'mentor', 'hash-mentor'),
  ('{OTHER_EVENT}', 'judge', 'hash-other');
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


def as_role(role, statement, uid="", check=True):
    return sql(f"SET test.uid = '{uid}'; SET ROLE {role}; {statement}", check=check)


def assert_denied(role, statement, uid=""):
    result = as_role(role, statement, uid=uid, check=False)
    assert result.returncode != 0 and "permission denied" in result.stderr, (role, statement, result.stderr)


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

        # A schema that differs from the repo must not fail the migration.
        sql(migration)

        sql(SCHEMA)
        sql(RLS_MIGRATION.read_text())
        baseline = as_role("authenticated", "SELECT count(password_hash) FROM public.role_passwords;", uid=STRANGER)
        assert baseline.stdout.strip() == "3", "Fixture must match the pre-migration grants"

        for _ in range(2):  # Applied twice: the migration must be idempotent.
            sql(migration)

            for role, uid in (("authenticated", STRANGER), ("authenticated", ORGANIZER), ("anon", "")):
                for statement in (
                    "SELECT password_hash FROM public.role_passwords;",
                    "SELECT * FROM public.role_passwords;",
                    "SELECT role FROM public.role_passwords WHERE password_hash LIKE '$2%';",
                    "SELECT role FROM public.role_passwords ORDER BY password_hash;",
                ):
                    assert_denied(role, statement, uid=uid)
            assert_denied("anon", "SELECT role FROM public.role_passwords;")
            assert_denied("authenticated", f"UPDATE public.role_passwords SET updated_at = now() "
                                           f"WHERE event_id = '{EVENT}' RETURNING password_hash;", uid=ORGANIZER)

            # What join-event-button reads.
            roles = as_role("authenticated", f"SELECT role FROM public.role_passwords "
                                              f"WHERE event_id = '{EVENT}' ORDER BY role;", uid=STRANGER)
            assert roles.stdout.split() == ["judge", "mentor"], roles.stdout

            # What /api/roles/verify reads.
            hash_read = as_role("service_role", f"SELECT password_hash FROM public.role_passwords "
                                                f"WHERE event_id = '{EVENT}' AND role = 'judge';")
            assert hash_read.stdout.strip() == "hash-judge", hash_read.stdout

        # The upsert PostgREST sends for /api/roles/set-password.
        upsert = (f"INSERT INTO public.role_passwords (event_id, role, password_hash, updated_at) "
                  f"VALUES ('{EVENT}', 'judge', 'hash-new', now()) ON CONFLICT (event_id, role) DO UPDATE "
                  f"SET password_hash = EXCLUDED.password_hash, updated_at = EXCLUDED.updated_at;")
        assert_denied("authenticated", upsert, uid=ORGANIZER)
        as_role("service_role", upsert)
        stored = sql(f"SELECT password_hash FROM public.role_passwords WHERE event_id = '{EVENT}' AND role = 'judge';")
        assert stored.stdout.strip() == "hash-new", stored.stdout

        # Organizer writes keep their RLS policies; event deletion clears rows this way.
        delete = "DELETE FROM public.role_passwords WHERE event_id = '{}' RETURNING role;"
        assert as_role("authenticated", delete.format(EVENT), uid=STRANGER).stdout.strip() == ""
        assert sorted(as_role("authenticated", delete.format(EVENT), uid=ORGANIZER).stdout.split()) == ["judge", "mentor"]
        remaining = sql(f"SELECT count(*) FROM public.role_passwords WHERE event_id = '{EVENT}';")
        assert remaining.stdout.strip() == "0", remaining.stdout
        print("PASS: hashes hidden from client roles, role names visible, service role reads and writes")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
