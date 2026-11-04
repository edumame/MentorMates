#!/usr/bin/env python3
"""Test the award/event migration in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Run from repository root.
"""
from pathlib import Path
import subprocess
import time
import uuid

MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/202611050037_keep_awards_with_their_event.sql"
CONTAINER = "mentormates-awards-test-" + uuid.uuid4().hex[:12]

EVENT_A, EVENT_B = str(uuid.uuid4()), str(uuid.uuid4())
TRACK_A, PRIZE_A = str(uuid.uuid4()), str(uuid.uuid4())
ORGANIZER_A, ORGANIZER_B, MEMBER = (str(uuid.uuid4()) for _ in range(3))

# Minimal stand-ins for the tables the migration touches, plus a policy with a
# name the migration does not know, as production may have.
SCHEMA = f"""
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE public.events (event_id uuid PRIMARY KEY);
CREATE TABLE public.event_tracks (
  track_id uuid PRIMARY KEY,
  event_id uuid REFERENCES public.events(event_id) ON DELETE CASCADE
);
CREATE TABLE public.prizes (
  id uuid PRIMARY KEY,
  track_id uuid REFERENCES public.event_tracks(track_id)
);
CREATE TABLE public.projects (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES public.events(event_id) ON DELETE SET NULL,
  project_name text
);
CREATE TABLE public.user_event_roles (user_id uuid, event_id uuid, role text);
CREATE TABLE public.prize_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_id uuid REFERENCES public.prizes(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  UNIQUE (prize_id, project_id)
);
CREATE TABLE public.project_round_advancements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  round_number int NOT NULL
);
ALTER TABLE public.prize_winners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read" ON public.prize_winners FOR SELECT USING (true);
CREATE POLICY "legacy unknown delete" ON public.prize_winners FOR DELETE TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
INSERT INTO public.events VALUES ('{EVENT_A}'), ('{EVENT_B}');
INSERT INTO public.event_tracks VALUES ('{TRACK_A}', '{EVENT_A}');
INSERT INTO public.prizes VALUES ('{PRIZE_A}', '{TRACK_A}');
INSERT INTO public.user_event_roles VALUES
  ('{ORGANIZER_A}', '{EVENT_A}', 'organizer'),
  ('{ORGANIZER_B}', '{EVENT_B}', 'organizer'),
  ('{MEMBER}', '{EVENT_A}', 'participant');
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
    return sql(f"SET test.uid = '{user}'; SET ROLE authenticated; {statement}", check=check)


def new_project(event=EVENT_A):
    project = str(uuid.uuid4())
    sql(f"INSERT INTO public.projects VALUES ('{project}', '{event}', 'Project');")
    return project


def award(project):
    sql(f"INSERT INTO public.prize_winners (prize_id, project_id) VALUES ('{PRIZE_A}', '{project}');")


def advance(project):
    sql(f"INSERT INTO public.project_round_advancements (event_id, project_id, round_number) "
        f"VALUES ('{EVENT_A}', '{project}', 2);")


def move(project, event):
    return f"UPDATE public.projects SET event_id = '{event}' WHERE id = '{project}';"


def winner_count(project):
    return sql(f"SELECT count(*) FROM public.prize_winners WHERE project_id = '{project}';").stdout.strip()


def assert_move_refused(result, message):
    assert result.returncode != 0 and message in result.stderr, result.stderr


def check_move_guard():
    won = new_project()
    award(won)
    assert_move_refused(sql(move(won, EVENT_B), check=False), "won a prize")
    assert_move_refused(as_user(ORGANIZER_B, move(won, EVENT_B), check=False), "won a prize")

    advanced = new_project()
    advance(advanced)
    assert_move_refused(as_user(ORGANIZER_B, move(advanced, EVENT_B), check=False), "advanced in judging")

    # Detaching and re-attaching does not launder the award.
    sql(f"UPDATE public.projects SET event_id = NULL WHERE id = '{won}';")
    assert_move_refused(sql(move(won, EVENT_B), check=False), "won a prize")

    plain = new_project()
    assert_move_refused(as_user(MEMBER, move(plain, EVENT_B), check=False), "part of an event")
    as_user(ORGANIZER_B, move(plain, EVENT_B))
    assert sql(f"SELECT event_id FROM public.projects WHERE id = '{plain}';").stdout.strip() == EVENT_B

    # Unchanged event_id is never refused, whoever writes it.
    as_user(MEMBER, move(plain, EVENT_B))


def check_prize_winner_rls():
    # A stale row, as left behind by a move made before this migration.
    moved = new_project(EVENT_B)
    award(moved)

    as_user(ORGANIZER_B, f"DELETE FROM public.prize_winners WHERE project_id = '{moved}';")
    assert winner_count(moved) == "1", "target organizer must not remove another event's prize"
    as_user(MEMBER, f"DELETE FROM public.prize_winners WHERE project_id = '{moved}';")
    assert winner_count(moved) == "1", "unknown legacy delete policy must be gone"
    as_user(ORGANIZER_A, f"DELETE FROM public.prize_winners WHERE project_id = '{moved}';")
    assert winner_count(moved) == "0", "awarding organizer must be able to remove the prize"

    assign = "INSERT INTO public.prize_winners (prize_id, project_id) VALUES ('{}', '{}');"
    foreign = new_project(EVENT_B)
    for user in (ORGANIZER_A, ORGANIZER_B):
        result = as_user(user, assign.format(PRIZE_A, foreign), check=False)
        assert result.returncode != 0 and "row-level security" in result.stderr, result.stderr
    local = new_project()
    as_user(ORGANIZER_A, assign.format(PRIZE_A, local))
    assert winner_count(local) == "1"


def check_event_delete_still_works():
    # projects.event_id is ON DELETE SET NULL, so deleting an event updates the
    # project while its award rows may still exist.
    event = str(uuid.uuid4())
    sql(f"INSERT INTO public.events VALUES ('{event}');")
    project = new_project(event)
    award(project)
    sql(f"INSERT INTO public.project_round_advancements (event_id, project_id, round_number) "
        f"VALUES ('{event}', '{project}', 2);")
    sql(f"DELETE FROM public.events WHERE event_id = '{event}';")
    assert sql(f"SELECT event_id IS NULL FROM public.projects WHERE id = '{project}';").stdout.strip() == "t"


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
        # The migration must be safe to re-run.
        sql(migration)
        check_move_guard()
        check_prize_winner_rls()
        check_event_delete_still_works()
        print("PASS: move guard, prize_winners RLS, event deletion, and re-run")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
