#!/usr/bin/env python3
"""Test the feedback sender RLS migration in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Supabase's auth schema and the tables the policies and trigger touch are stubbed;
the migration and can_view_project are the real ones from supabase/migrations.
"""
from pathlib import Path
import re
import subprocess
import time
import uuid

MIGRATIONS = Path(__file__).resolve().parents[1] / "supabase/migrations"
MIGRATION = MIGRATIONS / "202611050024_bind_feedback_sender_to_session.sql"
PROJECT_RLS = MIGRATIONS / "20251029_project_rls.sql"
CONTAINER = "mentormates-feedback-rls-test-" + uuid.uuid4().hex[:12]

EVENT = "00000000-0000-4000-8000-00000000000e"
OTHER_EVENT = "00000000-0000-4000-8000-00000000000f"
PUBLIC_PROJECT = "00000000-0000-4000-8000-0000000000a1"
PUBLIC_NO_EVENT_PROJECT = "00000000-0000-4000-8000-0000000000a2"
PRIVATE_PROJECT = "00000000-0000-4000-8000-0000000000b1"
MISSING_PROJECT = "00000000-0000-4000-8000-0000000000c1"
OUTSIDER = "00000000-0000-4000-8000-0000000000d1"
PARTICIPANT = "00000000-0000-4000-8000-0000000000d2"
VICTIM = "00000000-0000-4000-8000-0000000000d3"
UNNAMED = "00000000-0000-4000-8000-0000000000d4"
NO_AUTH_USER = "00000000-0000-4000-8000-0000000000d5"
OUTSIDER_SENDER = "Real Outsider|outsider@real.test"

SETUP = f"""
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
-- Not granted to anon or authenticated, as in Supabase.
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
CREATE TABLE public.projects (id uuid PRIMARY KEY, event_id uuid, private boolean NOT NULL DEFAULT false);
CREATE TABLE public.event_roles (event_id uuid, user_id uuid);
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_name text, mentor_email text, feedback_text text, mentor_id uuid,
  project_id uuid, event_id uuid
);
CREATE FUNCTION public.is_project_member(uuid, uuid) RETURNS boolean
  LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION public.user_has_event_role(p_event_id uuid, p_user_id uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.event_roles WHERE event_id = p_event_id AND user_id = p_user_id)
$$;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_select ON public.projects FOR SELECT
  USING (private = false OR public.can_view_project(id, (SELECT auth.uid())));
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
-- Selecting the row back must not be what decides these tests.
CREATE POLICY feedback_select ON public.feedback FOR SELECT USING (true);
-- The two kinds of old policy the migration has to replace.
CREATE POLICY "Event participants can submit feedback for projects in their events"
  ON public.feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "stray production insert policy" ON public.feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Mentors can edit their own feedback" ON public.feedback FOR UPDATE TO authenticated
  USING (mentor_id = (SELECT auth.uid())) WITH CHECK (mentor_id = (SELECT auth.uid()));
GRANT SELECT ON public.projects TO anon, authenticated;
GRANT ALL ON public.feedback TO anon, authenticated, service_role;
INSERT INTO public.projects VALUES
  ('{PUBLIC_PROJECT}', '{EVENT}', false),
  ('{PUBLIC_NO_EVENT_PROJECT}', NULL, false),
  ('{PRIVATE_PROJECT}', '{EVENT}', true);
INSERT INTO public.event_roles VALUES ('{EVENT}', '{PARTICIPANT}');
INSERT INTO auth.users VALUES
  ('{OUTSIDER}', 'outsider@real.test', '{{"full_name": "Real Outsider"}}'),
  ('{PARTICIPANT}', 'participant@real.test', '{{"full_name": "Real Participant"}}'),
  ('{VICTIM}', 'victim@real.test', '{{"full_name": "Head Judge"}}'),
  ('{UNNAMED}', 'unnamed@real.test', '{{"full_name": ""}}');
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


def as_user(uid, statement, role=None):
    role = role or ("authenticated" if uid else "anon")
    return sql(f"SET request.jwt.claim.sub = '{uid or ''}'; SET ROLE {role}; {statement}", check=False)


def quoted(value):
    return "NULL" if value is None else f"'{value}'"


def insert_sql(project=PUBLIC_PROJECT, event=EVENT, mentor=None, name=None, email=None, feedback_id=None):
    feedback_id = feedback_id or uuid.uuid4()
    return ("INSERT INTO public.feedback "
            "(id, project_id, event_id, mentor_id, mentor_name, mentor_email, feedback_text) VALUES "
            f"('{feedback_id}', {quoted(project)}, {quoted(event)}, {quoted(mentor)}, "
            f"{quoted(name)}, {quoted(email)}, 'x')")


def insert(uid, *args, **kwargs):
    return as_user(uid, insert_sql(*args, **kwargs) + ";")


def stored_sender(feedback_id):
    result = sql("SELECT coalesce(mentor_name, '<null>') || '|' || coalesce(mentor_email, '<null>') "
                 f"FROM public.feedback WHERE id = '{feedback_id}';")
    return result.stdout.strip()


def assert_stored_sender(uid, expected, label, **kwargs):
    feedback_id = uuid.uuid4()
    assert_allowed(insert(uid, mentor=uid, feedback_id=feedback_id, **kwargs), label)
    assert stored_sender(feedback_id) == expected, (label, stored_sender(feedback_id))


def assert_allowed(result, label):
    assert result.returncode == 0, (label, result.stderr)


def assert_denied(result, label):
    assert result.returncode != 0 and "row-level security" in result.stderr, (label, result.stderr)


def can_view_project_sql():
    match = re.search(r"CREATE OR REPLACE FUNCTION public\.can_view_project\(.*?\n\$\$;",
                      PROJECT_RLS.read_text(), re.DOTALL)
    assert match, "can_view_project not found"
    return match.group(0)


def check_inserts():
    # Anonymous senders stay allowed on public projects, but only as nobody.
    assert_allowed(insert(None), "anon on public project")
    assert_allowed(insert(None, PUBLIC_NO_EVENT_PROJECT, None), "anon on public project without event")
    assert_denied(insert(None, mentor=VICTIM), "anon forging mentor_id")
    assert_denied(insert(None, name="Head Judge"), "anon forging mentor_name")
    assert_denied(insert(None, email="x@y.test"), "anon forging mentor_email")
    assert_denied(insert(None, PRIVATE_PROJECT), "anon on private project")
    assert_denied(insert(None, MISSING_PROJECT, None), "anon on missing project")
    assert_denied(insert(None, None, None), "anon without project")

    # Signed-in senders are themselves.
    assert_stored_sender(OUTSIDER, OUTSIDER_SENDER, "signed-in as self",
                         name="Real Outsider", email="outsider@real.test")
    assert_allowed(insert(PARTICIPANT, PRIVATE_PROJECT, mentor=PARTICIPANT), "participant on private project")
    assert_denied(insert(OUTSIDER, mentor=VICTIM), "signed-in forging mentor_id")
    assert_denied(insert(OUTSIDER), "signed-in leaving mentor_id NULL")

    # event_id IS NULL used to skip the project check for signed-in users.
    assert_denied(insert(OUTSIDER, PRIVATE_PROJECT, None, OUTSIDER), "outsider on private project, NULL event")
    assert_denied(insert(OUTSIDER, PRIVATE_PROJECT, EVENT, OUTSIDER), "outsider on private project")
    assert_denied(insert(OUTSIDER, None, None, OUTSIDER), "signed-in without project")
    assert_denied(insert(OUTSIDER, PUBLIC_PROJECT, None, OUTSIDER), "NULL event on a project with an event")
    assert_denied(insert(OUTSIDER, PUBLIC_PROJECT, OTHER_EVENT, OUTSIDER), "wrong event for project")
    assert_denied(insert(OUTSIDER, PUBLIC_NO_EVENT_PROJECT, EVENT, OUTSIDER), "event on project without event")


def check_sender_columns():
    # Readers show these columns without consulting mentor_id, so a forged value
    # must never be what is stored. The trigger replaces it, which is why these
    # assert on the stored row and not on a rejection.
    assert_stored_sender(OUTSIDER, OUTSIDER_SENDER, "forging mentor_name", name="Head Judge")
    assert_stored_sender(OUTSIDER, OUTSIDER_SENDER, "forging mentor_email", email="victim@real.test")
    assert_stored_sender(OUTSIDER, OUTSIDER_SENDER, "forging both",
                         name="Head Judge", email="victim@real.test")
    assert_stored_sender(OUTSIDER, OUTSIDER_SENDER, "sending no sender columns")
    assert_stored_sender(UNNAMED, "<null>|unnamed@real.test", "blank full_name stores NULL", name="Head Judge")
    assert_stored_sender(NO_AUTH_USER, "<null>|<null>", "session without a user row", name="Head Judge", email="x@y.test")

    # Replacing the name and email doesn't get a forged mentor_id past the policy.
    assert_denied(insert(OUTSIDER, mentor=VICTIM, name="Head Judge", email="victim@real.test"),
                  "forging every sender column")

    # The service role has no session and is trusted with these columns.
    feedback_id = uuid.uuid4()
    assert_allowed(as_user(None, insert_sql(mentor=VICTIM, name="Imported", email="i@e.test",
                                            feedback_id=feedback_id) + ";", role="service_role"),
                   "service role insert")
    assert stored_sender(feedback_id) == "Imported|i@e.test", stored_sender(feedback_id)
    assert_allowed(as_user(None, f"UPDATE public.feedback SET mentor_name = 'Corrected' "
                                 f"WHERE id = '{feedback_id}';", role="service_role"),
                   "service role update")
    assert stored_sender(feedback_id) == "Corrected|i@e.test", stored_sender(feedback_id)


def check_updates():
    feedback_id = uuid.uuid4()
    assert_allowed(insert(OUTSIDER, mentor=OUTSIDER, feedback_id=feedback_id), "seeding own row")

    def update(assignment):
        return as_user(OUTSIDER, f"UPDATE public.feedback SET {assignment} WHERE id = '{feedback_id}';")

    def assert_sender_kept(result, label):
        assert_allowed(result, label)
        assert stored_sender(feedback_id) == OUTSIDER_SENDER, (label, stored_sender(feedback_id))

    assert_allowed(update("feedback_text = 'edited'"), "editing own text")
    assert_sender_kept(update("mentor_name = 'Head Judge'"), "changing mentor_name")
    assert_sender_kept(update("mentor_email = 'victim@real.test'"), "changing mentor_email")
    assert_sender_kept(update("mentor_name = NULL, mentor_email = NULL"), "clearing the sender")
    assert_sender_kept(as_user(OUTSIDER, insert_sql(mentor=OUTSIDER, name="Head Judge", email="victim@real.test",
                                                    feedback_id=feedback_id)
                               + " ON CONFLICT (id) DO UPDATE SET mentor_name = EXCLUDED.mentor_name,"
                                 " mentor_email = 'victim@real.test';"),
                       "changing the sender through an upsert")

    # A rename applies to new feedback and doesn't rewrite what was already sent.
    sql(f"UPDATE auth.users SET raw_user_meta_data = '{{\"full_name\": \"Renamed\"}}' WHERE id = '{OUTSIDER}';")
    assert_sender_kept(update("feedback_text = 'edited again'"), "editing after a rename")
    assert_stored_sender(OUTSIDER, "Renamed|outsider@real.test", "new feedback after a rename")

    assert_denied(update(f"project_id = '{PRIVATE_PROJECT}'"), "moving row to hidden project")
    assert_denied(update(f"event_id = '{OTHER_EVENT}'"), "moving row to another event")
    assert_denied(update(f"mentor_id = '{VICTIM}'"), "reassigning row to another mentor")


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
        # The projects policy names can_view_project, so it must exist first.
        setup_before, setup_after = SETUP.split("ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;")
        sql(setup_before)
        sql(can_view_project_sql())
        sql("ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;" + setup_after)

        migration = MIGRATION.read_text()
        sql(migration)
        sql(migration)  # Must be re-runnable.

        policies = sql("SELECT policyname FROM pg_policies WHERE tablename = 'feedback' AND cmd = 'INSERT';")
        # Compared by prefix because PostgreSQL truncates this name to 63 bytes.
        assert len(policies.stdout.split("\n")) == 2, policies.stdout
        assert policies.stdout.startswith("Event participants can submit feedback"), policies.stdout

        check_inserts()
        check_sender_columns()
        check_updates()
    finally:
        docker("rm", "--force", CONTAINER, check=False)
    print("feedback sender RLS test passed")


if __name__ == "__main__":
    main()
