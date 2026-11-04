#!/usr/bin/env python3
"""Test event deletion with intake data in a disposable PostgreSQL container.

Applies the real intake migrations on stub prerequisites, confirms a plain event
delete already removes retired intake data, then applies the RPC migration and
checks its atomic and permission behaviour. Accepts no database URL or production
connection. Requires Docker and Python3. Run from repository root.
"""
from pathlib import Path
import subprocess
import time
import uuid

MIGRATIONS = Path(__file__).resolve().parents[1] / "supabase/migrations"
INTAKE_MIGRATIONS = ("20260220_create_event_intake_forms.sql", "20260722_add_form_version_to_answers.sql")
FIX = MIGRATIONS / "202611050038_delete_event_with_related_rpc.sql"
CONTAINER = "mentormates-event-delete-test-" + uuid.uuid4().hex[:12]

OWNER, ORGANIZER, PARTICIPANT, MENTOR = (str(uuid.uuid4()) for _ in range(4))

# Tables the app created before the intake forms, trimmed to what the delete uses.
# event_tracks, feedback and platform_engagement have no cascade, as in the dump.
PREREQUISITES = f"""
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;

CREATE TABLE public.user_profiles (uid uuid PRIMARY KEY);
INSERT INTO public.user_profiles VALUES ('{OWNER}'), ('{ORGANIZER}'), ('{PARTICIPANT}'), ('{MENTOR}');
CREATE TABLE public.projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL
);
CREATE TABLE public.user_event_roles (
  event_id uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL
);
CREATE TABLE public.event_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE
);
CREATE TABLE public.event_tracks (
  track_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(event_id)
);
CREATE TABLE public.prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.event_tracks(track_id)
);
CREATE TABLE public.prize_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_id uuid NOT NULL REFERENCES public.prizes(id)
);
CREATE TABLE public.platform_engagement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(event_id)
);
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(event_id),
  mentor_id uuid NOT NULL
);

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql
  AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE FUNCTION public.is_admin_user(user_id uuid) RETURNS boolean LANGUAGE sql
  AS $$ SELECT false $$;
CREATE FUNCTION public.is_event_organizer(p_event_id uuid, p_user_id uuid)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public
  AS $$ SELECT EXISTS (SELECT 1 FROM public.user_event_roles
        WHERE event_id = p_event_id AND user_id = p_user_id AND role = 'organizer') $$;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_events ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY delete_events ON public.events FOR DELETE TO authenticated USING (
  owner_id = (SELECT auth.uid())
  OR public.is_event_organizer(event_id, (SELECT auth.uid()))
  OR public.is_admin_user((SELECT auth.uid()))
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_feedback ON public.feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY delete_own_feedback ON public.feedback FOR DELETE TO authenticated
  USING (mentor_id = (SELECT auth.uid()));
ALTER TABLE public.event_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_tracks ON public.event_tracks FOR SELECT TO authenticated USING (true);
CREATE POLICY delete_tracks ON public.event_tracks FOR DELETE TO authenticated
  USING (
    public.is_event_organizer(event_id, (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.events e
               WHERE e.event_id = event_tracks.event_id AND e.owner_id = (SELECT auth.uid()))
  );
ALTER TABLE public.user_event_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_roles ON public.user_event_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY delete_roles ON public.user_event_roles FOR DELETE TO authenticated
  USING (public.is_event_organizer(event_id, (SELECT auth.uid())));
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


def as_user(uid, statement, check=True):
    return sql(f"SET ROLE authenticated; SET test.uid = '{uid}'; {statement}", check=check)


def delete_rpc(uid, event, check=True):
    return as_user(uid, f"SELECT public.delete_event_with_related('{event}');", check=check)


def count(table, event):
    return int(sql(f"SELECT count(*) FROM public.{table} WHERE event_id = '{event}';").stdout.strip())


def intake_rows(event):
    return int(sql(f"""
        SELECT (SELECT count(*) FROM public.intake_form_templates WHERE event_id = '{event}')
             + (SELECT count(*) FROM public.event_intake_form_bindings WHERE event_id = '{event}')
             + (SELECT count(*) FROM public.intake_form_submissions WHERE event_id = '{event}');
    """).stdout.strip())


def orphaned_intake_rows():
    return int(sql("""
        SELECT (SELECT count(*) FROM public.intake_form_versions)
             + (SELECT count(*) FROM public.intake_form_submission_answers);
    """).stdout.strip())


def seed_event(with_related=True, other_mentor_feedback=False):
    """Create an event with a retired binding, as 'Delete questionnaire' leaves it."""
    event, template, version, submission = (str(uuid.uuid4()) for _ in range(4))
    related = ""
    if with_related:
        track, prize = str(uuid.uuid4()), str(uuid.uuid4())
        related = f"""
        INSERT INTO public.event_tickets (event_id) VALUES ('{event}');
        INSERT INTO public.event_tracks (track_id, event_id) VALUES ('{track}', '{event}');
        INSERT INTO public.prizes (id, track_id) VALUES ('{prize}', '{track}');
        INSERT INTO public.prize_winners (prize_id) VALUES ('{prize}');
        INSERT INTO public.platform_engagement (event_id) VALUES ('{event}');
        """
    if other_mentor_feedback:
        related += f"INSERT INTO public.feedback (event_id, mentor_id) VALUES ('{event}', '{MENTOR}');"
    sql(f"""
    INSERT INTO public.events (event_id, owner_id) VALUES ('{event}', '{OWNER}');
    INSERT INTO public.user_event_roles VALUES ('{event}', '{ORGANIZER}', 'organizer'),
                                               ('{event}', '{PARTICIPANT}', 'participant');
    INSERT INTO public.intake_form_templates (id, event_id, created_by, name)
      VALUES ('{template}', '{event}', '{OWNER}', 'Registration');
    INSERT INTO public.intake_form_versions (id, form_template_id, version_number, schema_json, created_by)
      VALUES ('{version}', '{template}', 1, '{{}}', '{OWNER}');
    INSERT INTO public.event_intake_form_bindings (event_id, context, form_version_id, is_active, created_by)
      VALUES ('{event}', 'registration', '{version}', false, '{OWNER}');
    INSERT INTO public.intake_form_submissions (id, event_id, context, form_version_id, submitter_user_id)
      VALUES ('{submission}', '{event}', 'registration', '{version}', '{PARTICIPANT}');
    INSERT INTO public.intake_form_submission_answers (submission_id, field_key, value_json, form_version_id)
      VALUES ('{submission}', 'name', '"Ada"', '{version}');
    {related}
    """)
    return event, template


def assert_event_gone(event):
    assert count("events", event) == 0
    assert count("user_event_roles", event) == 0
    assert count("event_tracks", event) == 0
    assert intake_rows(event) == 0
    assert orphaned_intake_rows() == 0, "Versions and answers must leave with their event"


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

        sql(PREREQUISITES)
        for name in INTAKE_MIGRATIONS:
            sql((MIGRATIONS / name).read_text())
        sql("GRANT USAGE ON SCHEMA public TO authenticated;"
            "GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;")

        # Intake data never blocks a plain event delete: the RESTRICT form_version_id
        # checks queue behind the event's cascades, so a retired binding, submission
        # and answer are already gone when they run.
        plain, _ = seed_event(with_related=False)
        sql(f"DELETE FROM public.events WHERE event_id = '{plain}';")
        assert_event_gone(plain)

        sql(FIX.read_text())
        sql(FIX.read_text())  # Must be idempotent.

        # Owner and non-owner organizer can both delete a fully populated event.
        for actor in (OWNER, ORGANIZER):
            event, _ = seed_event()
            delete_rpc(actor, event)
            assert_event_gone(event)

        # Someone without delete rights changes nothing, not even rows they could touch.
        event, template = seed_event()
        denied = delete_rpc(PARTICIPANT, event, check=False)
        assert denied.returncode != 0 and "Not allowed to delete event" in denied.stderr, denied.stderr
        assert count("events", event) == 1 and count("event_tracks", event) == 1
        assert count("event_tickets", event) == 1 and count("user_event_roles", event) == 2

        # Published form history stays protected outside an event delete.
        direct = sql(f"DELETE FROM public.intake_form_templates WHERE id = '{template}';", check=False)
        assert direct.returncode != 0 and "form_version_id_fkey" in direct.stderr, direct.stderr
        assert intake_rows(event) == 3
        delete_rpc(OWNER, event)
        assert_event_gone(event)

        # A row hidden by RLS blocks the delete, and everything else rolls back. The
        # non-owner organizer must also keep the role the old route removed first.
        for actor in (OWNER, ORGANIZER):
            event, _ = seed_event(other_mentor_feedback=True)
            refused = delete_rpc(actor, event, check=False)
            assert refused.returncode != 0 and "feedback_event_id_fkey" in refused.stderr, refused.stderr
            assert count("events", event) == 1 and count("event_tracks", event) == 1
            assert count("user_event_roles", event) == 2 and intake_rows(event) == 3

        anon = sql(f"SET ROLE anon; SELECT public.delete_event_with_related('{event}');", check=False)
        assert anon.returncode != 0 and "permission denied for function" in anon.stderr, anon.stderr
        print("PASS: event delete removes intake data atomically and refuses without partial deletes")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
