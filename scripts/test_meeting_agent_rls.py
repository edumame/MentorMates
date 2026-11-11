#!/usr/bin/env python3
"""Test meeting and agent read policies in a disposable PostgreSQL container.

Applies the real table migrations and then the real restriction, so a policy name
that fails to drop shows up here as a read that still succeeds.
"""
from rls_test_harness import Checks, Database

OWNER = "00000000-0000-0000-0000-00000000000a"
ORGANIZER = "00000000-0000-0000-0000-00000000000b"
JUDGE = "00000000-0000-0000-0000-00000000000c"
PARTICIPANT = "00000000-0000-0000-0000-00000000000d"
TEAMMATE = "00000000-0000-0000-0000-00000000000e"
STRANGER = "00000000-0000-0000-0000-00000000000f"
EVENT_OWNER = "00000000-0000-0000-0000-000000000010"
EVENT = "00000000-0000-0000-0000-0000000000e1"
LINKED_EVENT = "00000000-0000-0000-0000-0000000000e2"
PROJECT = "00000000-0000-0000-0000-0000000000f1"
MEETING = "00000000-0000-0000-0000-0000000000a1"
EVENT_AGENT = "00000000-0000-0000-0000-0000000000b1"
GLOBAL_AGENT = "00000000-0000-0000-0000-0000000000b2"
LINKED_AGENT = "00000000-0000-0000-0000-0000000000b3"

SCHEMA = """
CREATE TYPE public.meeting_status AS ENUM ('upcoming', 'active', 'completed', 'processing', 'cancelled');
CREATE TYPE public.event_role AS ENUM ('participant', 'mentor', 'judge', 'organizer', 'admin');
CREATE TABLE public.events (event_id uuid PRIMARY KEY, event_name text, owner_id uuid);
CREATE TABLE public.user_event_roles (
  user_id uuid NOT NULL, event_id uuid NOT NULL, role public.event_role NOT NULL,
  PRIMARY KEY (user_id, event_id)
);
CREATE TABLE public.projects (id uuid PRIMARY KEY, lead_email text, teammates text[]);
ALTER TABLE public.user_event_roles ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.is_admin_user(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.is_event_organizer_or_owner(p_event_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events WHERE event_id = p_event_id AND owner_id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.user_event_roles
                 WHERE event_id = p_event_id AND user_id = p_user_id AND role = 'organizer')
$$;
CREATE FUNCTION public.is_project_member(p_project_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p JOIN auth.users u ON u.id = p_user_id
    WHERE p.id = p_project_id AND (p.lead_email = u.email OR u.email = ANY (p.teammates))
  )
$$;
"""

SEED = f"""
GRANT SELECT ON public.meetings, public.agents, public.agent_events TO anon, authenticated;
GRANT INSERT ON public.agents, public.meetings TO authenticated;
INSERT INTO auth.users VALUES ('{TEAMMATE}', 'teammate@email.com'), ('{STRANGER}', 'stranger@email.com');
INSERT INTO public.events VALUES ('{EVENT}', 'Hack Night', '{EVENT_OWNER}'), ('{LINKED_EVENT}', 'Linked', NULL);
INSERT INTO public.user_event_roles VALUES
  ('{ORGANIZER}', '{EVENT}', 'organizer'), ('{JUDGE}', '{EVENT}', 'judge'),
  ('{PARTICIPANT}', '{EVENT}', 'participant'), ('{PARTICIPANT}', '{LINKED_EVENT}', 'participant');
INSERT INTO public.projects VALUES ('{PROJECT}', 'lead@email.com', ARRAY['teammate@email.com']);
INSERT INTO public.agents (id, name, user_id, instructions, event_id) VALUES
  ('{EVENT_AGENT}', 'Event', '{ORGANIZER}', 'secret', '{EVENT}'),
  ('{GLOBAL_AGENT}', 'Global', '{ORGANIZER}', 'shared', NULL),
  ('{LINKED_AGENT}', 'Linked', '{ORGANIZER}', 'linked', '{EVENT}');
INSERT INTO public.agent_events (agent_id, event_id) VALUES ('{LINKED_AGENT}', '{LINKED_EVENT}');
INSERT INTO public.meetings (id, name, user_id, event_id, project_id, summary)
VALUES ('{MEETING}', 'Call', '{OWNER}', '{EVENT}', '{PROJECT}', 'private summary');
"""


def count(db, role, uid, table, where="true"):
    ok, output = db.attempt(role, uid, f"SELECT count(*) FROM public.{table} WHERE {where}")
    return output.splitlines()[-1] if ok else f"error: {output}"


def main():
    checks = Checks()
    with Database("read-rls") as db:
        db.sql(SCHEMA)
        db.migrate("20260105_agents.sql", "20260105_meetings.sql", "20260211_agent_events.sql")
        db.sql(SEED)

        checks.expect("before: anonymous visitors can read meetings (test can detect it)",
                      count(db, "anon", None, "meetings"), "1")

        db.migrate("202611030002_restrict_meeting_agent_reads.sql")

        for table in ("meetings", "agents", "agent_events"):
            checks.expect(f"anonymous visitors cannot read {table}", count(db, "anon", None, table), "0")

        checks.expect("strangers cannot read meetings", count(db, "authenticated", STRANGER, "meetings"), "0")
        checks.expect("participants cannot read other people's meetings",
                      count(db, "authenticated", PARTICIPANT, "meetings"), "0")
        for label, uid in (("owner", OWNER), ("organizer", ORGANIZER), ("event owner", EVENT_OWNER),
                           ("judge", JUDGE), ("teammate", TEAMMATE)):
            checks.expect(f"{label} can still read the meeting", count(db, "authenticated", uid, "meetings"), "1")

        event_agent = f"id = '{EVENT_AGENT}'"
        linked_agent = f"id = '{LINKED_AGENT}'"
        global_agent = f"id = '{GLOBAL_AGENT}'"
        checks.expect("strangers cannot read event agents",
                      count(db, "authenticated", STRANGER, "agents", event_agent), "0")
        checks.expect("event members can read event agents",
                      count(db, "authenticated", PARTICIPANT, "agents", event_agent), "1")
        checks.expect("event owners can read event agents",
                      count(db, "authenticated", EVENT_OWNER, "agents", event_agent), "1")
        checks.expect("members of a linked event can read the agent",
                      count(db, "authenticated", PARTICIPANT, "agents", linked_agent), "1")
        checks.expect("signed-in users can still read platform agents",
                      count(db, "authenticated", STRANGER, "agents", global_agent), "1")
        checks.expect("agent owners can read their agents",
                      count(db, "authenticated", ORGANIZER, "agents"), "3")

        checks.expect("strangers cannot read agent links",
                      count(db, "authenticated", STRANGER, "agent_events"), "0")
        checks.expect("agent owners can read agent links",
                      count(db, "authenticated", ORGANIZER, "agent_events"), "1")
        checks.expect("event members can read their event's agent links",
                      count(db, "authenticated", PARTICIPANT, "agent_events"), "1")

        ok, _ = db.attempt("authenticated", STRANGER,
                           "INSERT INTO public.agents (name, user_id) VALUES ('Mine', auth.uid()) RETURNING id")
        checks.expect("creating an agent and reading it back still works", ok, True)

        ok, _ = db.attempt("authenticated", STRANGER,
                           "INSERT INTO public.meetings (name, user_id) VALUES ('Mine', auth.uid()) RETURNING id")
        checks.expect("creating a meeting and reading it back still works", ok, True)
    checks.finish()


if __name__ == "__main__":
    main()
