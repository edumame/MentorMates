#!/usr/bin/env python3
"""Test the global agent restriction migration in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Run from repository root.
"""
from pathlib import Path
import subprocess
import time
import uuid

MIGRATIONS = Path(__file__).resolve().parents[1] / "supabase/migrations"
BASE_POLICIES = MIGRATIONS / "20260217_agents_collaborative_editing.sql"
AGENT_EVENTS = MIGRATIONS / "20260211_agent_events.sql"
MIGRATION = MIGRATIONS / "202611090156_restrict_global_agents_to_admins.sql"
CONTAINER = "mentormates-agents-test-" + uuid.uuid4().hex[:12]

ADMIN = "00000000-0000-4000-8000-000000000001"
ORGANIZER = "00000000-0000-4000-8000-000000000002"
PARTICIPANT = "00000000-0000-4000-8000-000000000003"
STRANGER = "00000000-0000-4000-8000-000000000004"
EVENT = "00000000-0000-4000-8000-0000000000e1"
OTHER_EVENT = "00000000-0000-4000-8000-0000000000e2"

SCHEMA = f"""
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
CREATE FUNCTION public.is_admin_user(user_id uuid) RETURNS boolean LANGUAGE sql IMMUTABLE AS
  $$ SELECT user_id = '{ADMIN}'::uuid $$;
CREATE TABLE public.events (event_id uuid PRIMARY KEY, owner_id uuid, event_name text);
CREATE TABLE public.user_event_roles (event_id uuid, user_id uuid, role text);
CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  user_id uuid,
  -- SET NULL matches the staging catalog. The repo does not declare this FK, so
  -- check_event_delete also runs under the other actions.
  event_id uuid,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT agents_event_id_fkey FOREIGN KEY (event_id)
    REFERENCES public.events(event_id) ON DELETE SET NULL
);
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(event_id) ON DELETE SET NULL
);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.agents FOR SELECT USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated, service_role;
GRANT DELETE, SELECT ON public.events TO authenticated, service_role;
INSERT INTO public.events VALUES ('{EVENT}', NULL);
INSERT INTO public.user_event_roles VALUES ('{EVENT}', '{ORGANIZER}', 'organizer');
"""

# Stands in for the events delete policy in 20251104_events_rls.sql.
EVENTS_DELETE_POLICY = """
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Delete events" ON public.events FOR DELETE TO authenticated
  USING (public.can_manage_event_agents(event_id, auth.uid()));
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


def insert_agent(user, event=None):
    event_sql = f"'{event}'" if event else "NULL"
    return f"INSERT INTO public.agents (name, user_id, event_id) VALUES ('a', '{user}', {event_sql}) RETURNING id;"


def seed_agent(user, event=None):
    # Seeding as the table owner stands in for rows created before the migration.
    return scalar(insert_agent(user, event))


def scalar(statement):
    return sql(statement).stdout.strip()


def seed_event(event, owner):
    sql(f"INSERT INTO public.events (event_id, owner_id) VALUES ('{event}', '{owner}');")


def seed_meeting(agent, event):
    return scalar(f"INSERT INTO public.meetings (agent_id, event_id) VALUES ('{agent}', '{event}') RETURNING id;")


def link_agent(agent, event):
    sql(f"INSERT INTO public.agent_events (agent_id, event_id) VALUES ('{agent}', '{event}');")


def agent_event(agent):
    """Return 'missing', 'global' or the agent's event id, as another user reads it."""
    row = as_user(STRANGER, f"SELECT coalesce(event_id::text, 'global') FROM public.agents WHERE id = '{agent}';")
    return row.stdout.strip() or "missing"


def meeting_exists(meeting):
    return scalar(f"SELECT count(*) FROM public.meetings WHERE id = '{meeting}';") == "1"


def event_exists(event):
    return scalar(f"SELECT count(*) FROM public.events WHERE event_id = '{event}';") == "1"


def set_event_fk_action(action):
    sql(f"""
    ALTER TABLE public.agents DROP CONSTRAINT agents_event_id_fkey;
    ALTER TABLE public.agents ADD CONSTRAINT agents_event_id_fkey FOREIGN KEY (event_id)
      REFERENCES public.events(event_id) ON DELETE {action};
    """)


def delete_event(user, event, check=True):
    return as_user(user, f"DELETE FROM public.events WHERE event_id = '{event}';", check=check)


def check_event_delete(action):
    """Any user can create an event, so deleting one must not publish its agents."""
    set_event_fk_action(action)
    seed_event(EVENT, PARTICIPANT)
    seed_event(OTHER_EVENT, ADMIN)

    # Created through RLS, as a participant who owns an event would.
    owned = as_user(PARTICIPANT, insert_agent(PARTICIPANT, EVENT)).stdout.strip()
    admin_owned = seed_agent(ADMIN, EVENT)
    unowned = scalar(f"INSERT INTO public.agents (name, event_id) VALUES ('a', '{EVENT}') RETURNING id;")
    linked = seed_agent(PARTICIPANT, EVENT)
    link_agent(linked, EVENT)
    link_agent(linked, OTHER_EVENT)
    stale_link = seed_agent(PARTICIPANT, EVENT)
    link_agent(stale_link, "00000000-0000-4000-8000-0000000000e9")
    bystander = seed_agent(ORGANIZER, OTHER_EVENT)
    legacy_global = seed_agent(PARTICIPANT)
    owned_meeting = seed_meeting(owned, EVENT)
    linked_meeting = seed_meeting(linked, EVENT)

    # A user who cannot delete the event leaves it and its agents alone.
    delete_event(STRANGER, EVENT)
    assert event_exists(EVENT)
    assert agent_event(owned) == EVENT

    delete_event(PARTICIPANT, EVENT)
    assert not event_exists(EVENT), action
    for agent in (owned, admin_owned, unowned, stale_link):
        assert agent_event(agent) == "missing", (action, agent_event(agent))
    assert not meeting_exists(owned_meeting), action

    # An agent still in use by another event moves there, with its meetings.
    assert agent_event(linked) == OTHER_EVENT, (action, agent_event(linked))
    assert meeting_exists(linked_meeting), action

    # Nothing else moves.
    assert agent_event(bystander) == OTHER_EVENT, action
    assert agent_event(legacy_global) == "global", action
    sql("TRUNCATE public.events, public.agents, public.agent_events, public.meetings CASCADE;")


def check_event_delete_backstop():
    """A row the event trigger missed fails the delete instead of going global."""
    set_event_fk_action("SET NULL")
    sql("ALTER TABLE public.events DISABLE TRIGGER release_event_agents_trigger;")
    seed_event(EVENT, PARTICIPANT)
    agent = seed_agent(PARTICIPANT, EVENT)
    assert_denied(delete_event(PARTICIPANT, EVENT, check=False), "Only platform admins")
    assert_denied(sql(f"DELETE FROM public.events WHERE event_id = '{EVENT}';", check=False), "Only platform admins")
    assert event_exists(EVENT)
    assert agent_event(agent) == EVENT
    sql("ALTER TABLE public.events ENABLE TRIGGER release_event_agents_trigger;")


def assert_denied(result, message):
    assert result.returncode != 0, result.stdout
    assert message in result.stderr, result.stderr


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
        sql(SCHEMA)
        sql(AGENT_EVENTS.read_text())
        sql(BASE_POLICIES.read_text())
        sql(EVENTS_DELETE_POLICY)
        migration = MIGRATION.read_text()
        sql(migration)
        sql(migration)  # Must be safe to run twice.

        # Creating a global agent is admin-only; event agents still need event access.
        rls = "row-level security"
        assert_denied(as_user(PARTICIPANT, insert_agent(PARTICIPANT), check=False), rls)
        assert_denied(as_user(ORGANIZER, insert_agent(ORGANIZER), check=False), rls)
        assert_denied(as_user(PARTICIPANT, insert_agent(PARTICIPANT, EVENT), check=False), rls)
        assert_denied(as_user(PARTICIPANT, insert_agent(ADMIN), check=False), rls)
        as_user(ADMIN, insert_agent(ADMIN))
        as_user(ORGANIZER, insert_agent(ORGANIZER, EVENT))

        # An event agent's owner cannot make it global with a direct table update.
        event_agent = seed_agent(ORGANIZER, EVENT)
        promote = f"UPDATE public.agents SET event_id = NULL WHERE id = '{event_agent}';"
        assert_denied(as_user(ORGANIZER, promote, check=False), "Only platform admins")
        as_user(ORGANIZER, f"UPDATE public.agents SET name = 'renamed' WHERE id = '{event_agent}';")
        as_user(ADMIN, promote)

        # An existing global agent stays editable and removable by its owner.
        legacy = seed_agent(PARTICIPANT)
        as_user(PARTICIPANT, f"UPDATE public.agents SET name = 'renamed' WHERE id = '{legacy}';")
        as_user(PARTICIPANT, f"DELETE FROM public.agents WHERE id = '{legacy}';")

        sql("TRUNCATE public.events, public.agents, public.agent_events, public.meetings CASCADE;")
        for action in ("SET NULL", "NO ACTION", "CASCADE"):
            check_event_delete(action)
        check_event_delete_backstop()
        print("PASS: global agents are admin-only, and deleting an event never publishes its agents")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
