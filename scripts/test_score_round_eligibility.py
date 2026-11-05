#!/usr/bin/env python3
"""Test the score round eligibility trigger in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Run from repository root.
"""
from pathlib import Path
import subprocess
import time
import uuid

MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/202611050143_validate_score_round_eligibility.sql"
CONTAINER = "mentormates-score-round-test-" + uuid.uuid4().hex[:12]

EVENT = "00000000-0000-0000-0000-00000000000e"
OTHER_EVENT = "00000000-0000-0000-0000-00000000000f"
JUDGE = "00000000-0000-0000-0000-0000000000a1"
ORGANIZER = "00000000-0000-0000-0000-0000000000a2"
ADVANCED = "00000000-0000-0000-0000-0000000000b1"
ELIMINATED = "00000000-0000-0000-0000-0000000000b2"
DRAFT = "00000000-0000-0000-0000-0000000000b3"
UNASSIGNED = "00000000-0000-0000-0000-0000000000b4"

# Only the columns the trigger reads, matching the names in supabase/migrations.
SCHEMA = f"""
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
CREATE TABLE public.projects (id uuid PRIMARY KEY, event_id uuid, submitted boolean);
CREATE TABLE public.user_event_roles (user_id uuid, event_id uuid, role text);
CREATE TABLE public.project_assignments (project_id uuid, user_id uuid, event_id uuid, role text);
CREATE TABLE public.project_round_advancements (event_id uuid, project_id uuid, round_number int);
CREATE TABLE public.project_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid, judge_id uuid, event_id uuid,
  round_number int NOT NULL DEFAULT 1, comments text
);
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_scores TO authenticated;
INSERT INTO public.projects VALUES
  ('{ADVANCED}', '{EVENT}', true), ('{ELIMINATED}', '{EVENT}', true),
  ('{DRAFT}', '{EVENT}', false), ('{UNASSIGNED}', '{EVENT}', true);
INSERT INTO public.user_event_roles VALUES
  ('{JUDGE}', '{EVENT}', 'judge'), ('{ORGANIZER}', '{EVENT}', 'organizer');
INSERT INTO public.project_assignments VALUES
  ('{ADVANCED}', '{JUDGE}', '{EVENT}', 'judge'),
  ('{ELIMINATED}', '{JUDGE}', '{EVENT}', 'judge'),
  ('{DRAFT}', '{JUDGE}', '{EVENT}', 'judge');
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


def as_user(user, statement, check=True):
    return sql(f"SET request.jwt.sub = '{user}'; SET ROLE authenticated; {statement}", check=check)


def insert_score(user, project, round_number, event=EVENT, check=True):
    return as_user(user, "INSERT INTO public.project_scores (project_id, judge_id, event_id, round_number) "
                         f"VALUES ('{project}', '{user}', '{event}', {round_number});", check=check)


def assert_rejected(result, message):
    assert result.returncode != 0 and message in result.stderr, result.stderr


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
        # A score left from before the cut, which the trigger must not disturb.
        sql(f"INSERT INTO public.project_scores (project_id, judge_id, event_id, round_number) "
            f"VALUES ('{ELIMINATED}', '{JUDGE}', '{EVENT}', 2);")
        sql(migration)
        sql(migration)  # Idempotent on a database that already has it.

        not_eligible = "not eligible for judging round"
        # Round 1 with no advancement rows: submitted projects only.
        insert_score(JUDGE, ADVANCED, 1)
        assert_rejected(insert_score(JUDGE, DRAFT, 1, check=False), not_eligible)
        assert_rejected(insert_score(JUDGE, ADVANCED, 1, event=OTHER_EVENT, check=False), not_eligible)
        # A later round nobody has advanced to.
        assert_rejected(insert_score(JUDGE, ADVANCED, 2, check=False), not_eligible)

        sql(f"INSERT INTO public.project_round_advancements VALUES ('{EVENT}', '{ADVANCED}', 2), ('{EVENT}', '{UNASSIGNED}', 2);")
        # Round 2 holds exactly the advanced projects, whoever is writing.
        insert_score(JUDGE, ADVANCED, 2)
        assert_rejected(insert_score(JUDGE, ELIMINATED, 2, check=False), not_eligible)
        assert_rejected(insert_score(ORGANIZER, ELIMINATED, 2, check=False), not_eligible)
        # Assignment binds judges, not organizers.
        assert_rejected(insert_score(JUDGE, UNASSIGNED, 2, check=False), "not assigned")
        insert_score(ORGANIZER, UNASSIGNED, 2)

        # A dropped project's old score cannot be edited, but can be removed.
        stale = f"project_id = '{ELIMINATED}' AND round_number = 2"
        assert_rejected(as_user(JUDGE, f"UPDATE public.project_scores SET comments = 'x' WHERE {stale};", check=False),
                        not_eligible)
        as_user(JUDGE, f"DELETE FROM public.project_scores WHERE {stale};")
        assert sql(f"SELECT count(*) FROM public.project_scores WHERE {stale};").stdout.strip() == "0"
        # Editing a score for a project still in the round keeps working.
        as_user(JUDGE, f"UPDATE public.project_scores SET comments = 'x' WHERE project_id = '{ADVANCED}' AND round_number = 2;")
        print("PASS: round eligibility, draft, cross-event, assignment, organizer, update and delete cases")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
