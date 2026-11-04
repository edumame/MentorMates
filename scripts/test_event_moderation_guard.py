#!/usr/bin/env python3
"""Test the event moderation guard migration in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Run from repository root.
"""
from pathlib import Path
import subprocess
import time
import uuid

MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/202611050002_guard_event_moderation_columns.sql"
CONTAINER = "mentormates-moderation-test-" + uuid.uuid4().hex[:12]
ADMIN = "00000000-0000-0000-0000-00000000000a"
OWNER = "00000000-0000-0000-0000-00000000000b"

# The minimum of the production schema that the guard and these checks touch.
SCHEMA = f"""
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
CREATE FUNCTION public.is_admin_user(user_id uuid) RETURNS boolean LANGUAGE sql IMMUTABLE AS
  $$ SELECT user_id = '{ADMIN}'::uuid $$;
CREATE TYPE public.approval_status AS ENUM ('not_submitted', 'submitted', 'approved', 'rejected');
CREATE TYPE public.event_visibility AS ENUM ('test', 'demo', 'private', 'public', 'draft', 'archived');
CREATE TABLE public.events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text,
  owner_id uuid,
  visibility public.event_visibility DEFAULT 'draft',
  approval_status public.approval_status DEFAULT 'not_submitted',
  featured boolean DEFAULT false
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_select ON public.events FOR SELECT USING (true);
CREATE POLICY events_insert ON public.events FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_admin_user(auth.uid()));
CREATE POLICY events_update ON public.events FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin_user(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_admin_user(auth.uid()));
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.events TO anon, authenticated, service_role;
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


def as_user(uid, statement, role="authenticated"):
    return sql(f"SET test.uid = '{uid}'; SET ROLE {role}; {statement}", check=False)


def seed(visibility="draft", approval="not_submitted", featured="false"):
    event_id = str(uuid.uuid4())
    sql(f"INSERT INTO public.events (event_id, owner_id, visibility, approval_status, featured) "
        f"VALUES ('{event_id}', '{OWNER}', '{visibility}', '{approval}', {featured});")
    return event_id


def insert(visibility="draft", approval="not_submitted", featured="false", owner=OWNER):
    return (f"INSERT INTO public.events (owner_id, visibility, approval_status, featured) "
            f"VALUES ('{owner}', '{visibility}', '{approval}', {featured});")


def update(event_id, assignment):
    return f"UPDATE public.events SET {assignment} WHERE event_id = '{event_id}';"


def assert_denied(result, context):
    assert result.returncode != 0 and "Only admins" in result.stderr, (context, result.stderr)


def assert_allowed(result, context):
    assert result.returncode == 0, (context, result.stderr)


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
        sql(migration)
        sql(migration)  # The migration must be safe to re-run.

        # A non-admin cannot create a moderated event.
        for label, statement in (
            ("insert approved", insert(approval="approved")),
            ("insert rejected", insert(approval="rejected")),
            ("insert featured", insert(featured="true")),
            ("insert public", insert(visibility="public")),
            ("insert public submitted", insert(visibility="public", approval="submitted")),
            ("insert all three", insert(visibility="public", approval="approved", featured="true")),
        ):
            assert_denied(as_user(OWNER, statement), label)

        # Ordinary creation keeps working, including the request-approval insert.
        for label, statement in (
            ("insert draft", insert()),
            ("insert private", insert(visibility="private")),
            ("insert submitted", insert(visibility="private", approval="submitted")),
        ):
            assert_allowed(as_user(OWNER, statement), label)

        # A non-admin cannot moderate an event they own.
        draft = seed()
        for label, assignment in (
            ("self-approve", "approval_status = 'approved'"),
            ("self-reject", "approval_status = 'rejected'"),
            ("self-feature", "featured = true"),
            ("publish unapproved", "visibility = 'public'"),
            ("publish and approve", "visibility = 'public', approval_status = 'approved'"),
        ):
            assert_denied(as_user(OWNER, update(draft, assignment)), label)
        assert_denied(as_user(OWNER, update(seed(featured="true"), "featured = false")), "unfeature")
        assert_denied(as_user(OWNER, update(seed(visibility="private", approval="submitted"),
                                            "visibility = 'public'")), "publish submitted")
        assert_denied(as_user(OWNER, update(seed(visibility="private", approval="approved"),
                                            "visibility = 'public', approval_status = 'submitted'")),
                      "publish while leaving approved")
        assert sql(f"SELECT visibility, approval_status, featured FROM public.events "
                   f"WHERE event_id = '{draft}';").stdout.strip() == "draft|not_submitted|f"

        # Organizer flows keep working.
        assert_allowed(as_user(OWNER, update(seed(), "approval_status = 'submitted'")), "submit")
        assert_allowed(as_user(OWNER, update(seed(approval="rejected"), "approval_status = 'submitted'")), "resubmit")
        assert_allowed(as_user(OWNER, update(seed(visibility="private", approval="approved"),
                                             "visibility = 'public'")), "publish approved")
        assert_allowed(as_user(OWNER, update(seed(visibility="public", approval="approved"),
                                             "visibility = 'private'")), "unpublish approved")
        assert_allowed(as_user(OWNER, update(seed(visibility="public", approval="submitted"),
                                             "visibility = 'private'")), "public submission to private")
        assert_allowed(as_user(OWNER, update(seed(visibility="public", approval="approved"),
                                             "visibility = 'archived'")), "archive")
        assert_allowed(as_user(OWNER, update(seed(visibility="archived", approval="approved"),
                                             "visibility = 'private'")), "unarchive")
        # Rewriting current values on an approved, featured event is not a change.
        assert_allowed(as_user(OWNER, update(seed(visibility="public", approval="approved", featured="true"),
                                             "visibility = 'public', approval_status = 'approved', featured = true")),
                       "unchanged values")
        assert_allowed(as_user(OWNER, update(seed(visibility="public", approval="approved", featured="true"),
                                             "event_name = 'Renamed'")), "edit other column")

        # Admins keep full control, through the same role as everyone else.
        assert_allowed(as_user(ADMIN, insert(visibility="public", approval="approved", featured="true", owner=ADMIN)),
                       "admin insert")
        assert_allowed(as_user(ADMIN, update(draft, "visibility = 'public', approval_status = 'approved', featured = true")),
                       "admin moderate")

        # Service role paths (public-submit, agent API) have no auth.uid() to check.
        assert_allowed(as_user("", insert(visibility="public", approval="submitted", owner=OWNER), role="service_role"),
                       "public-submit")
        assert_allowed(as_user("", update(seed(), "visibility = 'public'"), role="service_role"), "agent update")

        # A spoofed JWT cannot help: the guard reads the database role and the verified uid.
        assert_denied(as_user(OWNER, "SET request.jwt.claim.role = 'service_role'; "
                                     + insert(approval="approved")), "spoofed claim")

        print("PASS: non-admin moderation denied on INSERT and UPDATE, organizer, admin and service paths intact")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
