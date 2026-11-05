#!/usr/bin/env python3
"""Test the project vote rules migration in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Run from repository root.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import time
import uuid

from test_scraper_quota import CONTAINER, docker, sql

MIGRATIONS = Path(__file__).resolve().parents[1] / "supabase/migrations"
TABLE_MIGRATION = MIGRATIONS / "20251224_create_project_votes.sql"
RULES_MIGRATION = MIGRATIONS / "202611050081_enforce_project_vote_rules.sql"

# Minimal stand-ins for the Supabase and app schema. RLS is on with no policies
# and nothing is granted, so voters cannot read these tables themselves.
STUB_SCHEMA = """
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE TYPE public.event_role AS ENUM ('participant', 'mentor', 'judge', 'organizer', 'admin', 'event');
CREATE TABLE public.events (event_id uuid PRIMARY KEY);
CREATE TABLE public.projects (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES public.events(event_id),
  submitted boolean DEFAULT false
);
CREATE TABLE public.user_event_roles (
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  role public.event_role NOT NULL,
  UNIQUE (user_id, event_id)
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_event_roles ENABLE ROW LEVEL SECURITY;
"""

EVENT = str(uuid.uuid4())
OTHER_EVENT = str(uuid.uuid4())


def new_user(role=None, event=EVENT):
    user = str(uuid.uuid4())
    sql(f"INSERT INTO auth.users VALUES ('{user}');")
    if role:
        sql(f"INSERT INTO public.user_event_roles VALUES ('{user}', '{event}', '{role}');")
    return user


def new_project(event=EVENT, submitted="true"):
    project = str(uuid.uuid4())
    sql(f"INSERT INTO public.projects VALUES ('{project}', '{event}', {submitted});")
    return project


def as_voter(user, statement):
    """Run a statement the way PostgREST does for a signed-in user."""
    return sql(
        "\\set VERBOSITY verbose\n"
        f"SET request.jwt.claim.sub = '{user}'; SET ROLE authenticated; {statement}",
        check=False,
    )


def vote(user, project, event=EVENT):
    return as_voter(
        user,
        f"INSERT INTO public.project_votes (project_id, user_id, event_id) VALUES ('{project}', '{user}', '{event}');",
    )


def assert_rejected(result, code):
    assert result.returncode != 0 and f"ERROR:  {code}" in result.stderr, (code, result.stderr)


def assert_accepted(result):
    assert result.returncode == 0, result.stderr


def vote_count(user, event=EVENT):
    return int(sql(
        f"SELECT count(*) FROM public.project_votes WHERE user_id = '{user}' AND event_id = '{event}';"
    ).stdout.strip())


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

        sql(STUB_SCHEMA)
        sql(TABLE_MIGRATION.read_text())
        sql("GRANT SELECT, INSERT, DELETE ON public.project_votes TO authenticated;")
        sql(f"INSERT INTO public.events VALUES ('{EVENT}'), ('{OTHER_EVENT}');")

        # Votes stored before the migration survive it, even over the cap.
        legacy_voter = new_user("participant")
        for _ in range(4):
            assert_accepted(vote(legacy_voter, new_project()))

        rules_migration = RULES_MIGRATION.read_text()
        sql(rules_migration)
        sql(rules_migration)  # Idempotent: production history is unknown.
        assert vote_count(legacy_voter) == 4
        assert_rejected(vote(legacy_voter, new_project()), "VT003")

        project = new_project()

        # Eligibility: non-members and judges cannot vote.
        assert_rejected(vote(new_user(), project), "VT001")
        assert_rejected(vote(new_user("judge"), project), "VT001")
        member_of_other_event = new_user("participant", OTHER_EVENT)
        assert_rejected(vote(member_of_other_event, project), "VT001")
        for role in ("participant", "mentor", "organizer", "admin"):
            assert_accepted(vote(new_user(role), project))

        # A voter can still only insert their own row.
        voter = new_user("participant")
        spoofed = as_voter(
            new_user("participant"),
            f"INSERT INTO public.project_votes (project_id, user_id, event_id) VALUES ('{project}', '{voter}', '{EVENT}');",
        )
        assert spoofed.returncode != 0 and "row-level security" in spoofed.stderr, spoofed.stderr

        # Project rules: must be submitted and belong to the vote's event.
        assert_rejected(vote(voter, new_project(submitted="false")), "VT002")
        assert_rejected(vote(voter, new_project(submitted="NULL")), "VT002")
        assert_rejected(vote(voter, new_project(event=OTHER_EVENT)), "VT002")
        both_events_voter = new_user("participant")
        sql(f"INSERT INTO public.user_event_roles VALUES ('{both_events_voter}', '{OTHER_EVENT}', 'participant');")
        assert_rejected(vote(both_events_voter, project, OTHER_EVENT), "VT002")
        assert vote_count(voter) == 0

        # The cap is per event, and removing a vote frees a slot.
        first_choice = new_project()
        for choice in (first_choice, new_project(), new_project()):
            assert_accepted(vote(voter, choice))
        assert_rejected(vote(voter, new_project()), "VT003")
        assert_accepted(as_voter(voter, f"DELETE FROM public.project_votes WHERE project_id = '{first_choice}';"))
        assert_accepted(vote(voter, new_project()))
        assert vote_count(voter) == 3
        sql(f"INSERT INTO public.user_event_roles VALUES ('{voter}', '{OTHER_EVENT}', 'participant');")
        assert_accepted(vote(voter, new_project(event=OTHER_EVENT), OTHER_EVENT))

        # One statement inserting several rows cannot pass the cap either.
        bulk_voter = new_user("participant")
        rows = ", ".join(f"('{new_project()}', '{bulk_voter}', '{EVENT}')" for _ in range(4))
        bulk = as_voter(bulk_voter, f"INSERT INTO public.project_votes (project_id, user_id, event_id) VALUES {rows};")
        assert_rejected(bulk, "VT003")
        assert vote_count(bulk_voter) == 0

        # Twenty independent database sessions race for the same three slots.
        racer = new_user("participant")
        projects = [new_project() for _ in range(20)]
        with ThreadPoolExecutor(max_workers=20) as pool:
            results = list(pool.map(lambda choice: vote(racer, choice), projects))
        assert sum(result.returncode == 0 for result in results) == 3, [r.stderr for r in results]
        for result in results:
            if result.returncode:
                assert_rejected(result, "VT003")
        assert vote_count(racer) == 3

        # The trigger function is not callable through the API.
        direct = as_voter(voter, "SELECT public.enforce_project_vote_rules();")
        assert direct.returncode != 0 and "permission denied" in direct.stderr, direct.stderr

        print("PASS: eligibility, project rules, atomic cap, bulk insert, existing votes, and idempotency")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
