#!/usr/bin/env python3
"""Test auto conversations for linked agents in a disposable PostgreSQL container.

Applies the real migrations to a minimal fixture schema. No database URL or
production connection is accepted. Requires Docker and Python3.
"""
from pathlib import Path
import json
import time
import uuid

from test_scraper_quota import CONTAINER, docker, sql

MIGRATIONS = Path(__file__).resolve().parents[1] / "supabase/migrations"
ORIGINAL = MIGRATIONS / "20260206_add_auto_conversations_on_join.sql"
AGENT_EVENTS = MIGRATIONS / "20260211_agent_events.sql"
FIX = MIGRATIONS / "202611091101_auto_conversations_linked_agents.sql"

# Only the columns the migrations under test read or write.
FIXTURE = """
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
CREATE TYPE public.event_role AS ENUM ('participant', 'mentor');
CREATE TYPE public.meeting_status AS ENUM ('upcoming', 'completed');
CREATE TABLE public.events (
  event_id uuid PRIMARY KEY,
  event_name text,
  session_caps jsonb
);
CREATE TABLE public.agents (
  id uuid PRIMARY KEY,
  user_id uuid,
  name text,
  event_id uuid,
  enabled boolean
);
CREATE TABLE public.user_event_roles (
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  role public.event_role NOT NULL
);
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  user_id uuid,
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
  event_id uuid,
  status public.meeting_status DEFAULT 'upcoming',
  created_at timestamptz,
  updated_at timestamptz
);
"""


def new_id():
    return str(uuid.uuid4())


def add_agent(name, event_id=None, enabled="true", linked_to=()):
    agent_id = new_id()
    owner = f"'{event_id}'" if event_id else "NULL"
    sql(f"INSERT INTO public.agents (id, name, event_id, enabled) VALUES ('{agent_id}', '{name}', {owner}, {enabled});")
    for linked_event in linked_to:
        sql(f"INSERT INTO public.agent_events (agent_id, event_id) VALUES ('{agent_id}', '{linked_event}');")
    return agent_id


def create_for(user, event):
    return sql(f"SELECT public.create_auto_conversations_for_event_role('{user}', '{event}', 'participant');").stdout.strip()


def meeting_names(user, event):
    rows = sql(f"SELECT name FROM public.meetings WHERE user_id='{user}' AND event_id='{event}' ORDER BY name;")
    return rows.stdout.split("\n")[:-1]


def main():
    docker("pull", "postgres:16.15", timeout=600)
    try:
        docker("run", "--detach", "--name", CONTAINER, "--network", "none",
               "--tmpfs", "/var/lib/postgresql/data:rw", "--env",
               "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:16.15")
        for _ in range(60):
            # TCP readiness only succeeds once the image's final server is running.
            if docker("exec", CONTAINER, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", check=False).returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise RuntimeError("Disposable PostgreSQL failed to start")

        sql(FIXTURE)
        sql(ORIGINAL.read_text())
        sql(AGENT_EVENTS.read_text())

        event, source_event, other_event = new_id(), new_id(), new_id()
        sql(f"INSERT INTO public.events (event_id, event_name) VALUES ('{event}', 'Target'), ('{source_event}', 'Source'), ('{other_event}', 'Other');")

        # Created after the junction seed, like agents.create: no agent_events row.
        owned = add_agent("Owned", event_id=event)
        linked = add_agent("Linked", event_id=source_event, linked_to=[event])
        linked_global = add_agent("Linked global", linked_to=[event])
        linked_null_enabled = add_agent("Linked null enabled", enabled="NULL", linked_to=[event])
        disabled_linked = add_agent("Disabled linked", enabled="false", linked_to=[event])
        disabled_owned = add_agent("Disabled owned", event_id=event, enabled="false")
        elsewhere = add_agent("Linked elsewhere", event_id=source_event, linked_to=[other_event])
        unrelated = add_agent("Unrelated")

        caps = {"auto_conversations": {"participant": [
            owned, linked, linked_global, linked_null_enabled, disabled_linked,
            disabled_owned, elsewhere, unrelated, "not-a-uuid",
        ]}}
        sql(f"UPDATE public.events SET session_caps = '{json.dumps(caps)}' WHERE event_id='{event}';")

        # The original function must show the bug, or this test proves nothing.
        before = new_id()
        assert create_for(before, event) == "1", "Only the owned agent should be created before the fix"
        assert meeting_names(before, event) == ["TODO: Owned"]

        sql(FIX.read_text())
        sql(FIX.read_text())  # Re-running the migration must be safe.

        expected = ["TODO: Linked", "TODO: Linked global", "TODO: Linked null enabled", "TODO: Owned"]

        # The real path: a participant joins and the trigger creates the meetings.
        joined = new_id()
        sql(f"INSERT INTO public.user_event_roles VALUES ('{joined}', '{event}', 'participant');")
        assert meeting_names(joined, event) == expected, meeting_names(joined, event)
        assert sql(f"SELECT DISTINCT status FROM public.meetings WHERE user_id='{joined}';").stdout.strip() == "upcoming"

        # Repeat runs create nothing new, and the earlier user only gains what was missing.
        assert create_for(joined, event) == "0"
        assert meeting_names(joined, event) == expected
        assert create_for(before, event) == "3"
        assert meeting_names(before, event) == expected

        direct = new_id()
        assert create_for(direct, event) == "4"

        # Unlinking stops new meetings for that agent.
        sql(f"DELETE FROM public.agent_events WHERE agent_id='{linked}' AND event_id='{event}';")
        unlinked = new_id()
        assert create_for(unlinked, event) == "3"
        assert "TODO: Linked" not in meeting_names(unlinked, event)

        # Without agent_events the migration must stop, not install a function
        # that would raise inside the join trigger.
        sql("ALTER TABLE public.agent_events RENAME TO agent_events_hidden;")
        sql("DROP FUNCTION public.create_auto_conversations_for_event_role(uuid, uuid, public.event_role);")
        missing = sql(FIX.read_text(), check=False)
        assert missing.returncode != 0 and "agent_events is missing" in missing.stderr, missing.stderr
        assert sql("SELECT to_regproc('public.create_auto_conversations_for_event_role');").stdout.strip() == ""
        print("PASS: linked, owned, disabled, unrelated, idempotent, unlinked, and missing-table cases")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
