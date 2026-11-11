#!/usr/bin/env python3
"""Test the project event-move guard against round advancements in disposable Postgres only."""
from rls_test_harness import Checks, Database

EVENT_A = '00000000-0000-0000-0000-00000000000a'
EVENT_B = '00000000-0000-0000-0000-00000000000b'
ORGANIZER_A = '00000000-0000-0000-0000-000000000001'
ORGANIZER_B = '00000000-0000-0000-0000-000000000002'
OUTSIDER = '00000000-0000-0000-0000-000000000003'
ADVANCED = '10000000-0000-0000-0000-000000000001'
WON = '10000000-0000-0000-0000-000000000002'
PLAIN = '10000000-0000-0000-0000-000000000003'
DELETED_EVENT = '00000000-0000-0000-0000-00000000000d'
DELETED_PROJECT = '10000000-0000-0000-0000-000000000004'

# Minimal stand-ins for what guard_project_event_change reads.
SCHEMA = f"""
CREATE TABLE events(event_id uuid PRIMARY KEY);
CREATE TABLE user_event_roles(user_id uuid, event_id uuid, role text);
CREATE TABLE projects(id uuid PRIMARY KEY, event_id uuid REFERENCES events(event_id) ON DELETE SET NULL);
CREATE TABLE project_scores(project_id uuid);
CREATE TABLE prize_winners(project_id uuid);
CREATE TABLE project_votes(project_id uuid);
CREATE TABLE project_round_advancements(
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  round_number int NOT NULL
);
CREATE FUNCTION user_has_event_role(uuid, uuid) RETURNS boolean LANGUAGE sql AS
  $$ SELECT EXISTS(SELECT 1 FROM user_event_roles WHERE event_id = $1 AND user_id = $2) $$;
CREATE FUNCTION is_event_organizer_or_owner(uuid, uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION is_admin_user(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
INSERT INTO events VALUES ('{EVENT_A}'), ('{EVENT_B}'), ('{DELETED_EVENT}');
INSERT INTO user_event_roles VALUES ('{ORGANIZER_A}', '{EVENT_A}', 'organizer'), ('{ORGANIZER_B}', '{EVENT_B}', 'organizer');
INSERT INTO projects VALUES ('{ADVANCED}', '{EVENT_A}'), ('{WON}', '{EVENT_A}'), ('{PLAIN}', '{EVENT_A}'),
  ('{DELETED_PROJECT}', '{DELETED_EVENT}');
INSERT INTO project_round_advancements VALUES ('{ADVANCED}', '{EVENT_A}', 2), ('{DELETED_PROJECT}', '{DELETED_EVENT}', 2);
INSERT INTO prize_winners VALUES ('{WON}');
GRANT SELECT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
"""


def move(project, event):
    target = 'NULL' if event is None else f"'{event}'"
    return f"UPDATE projects SET event_id = {target} WHERE id = '{project}'"


def event_of(db, project):
    return db.sql(f"SELECT coalesce(event_id::text, 'null') FROM projects WHERE id = '{project}'")


def main():
    checks = Checks()
    with Database('project-event-awards') as db:
        db.sql(SCHEMA)
        db.migrate('202611091102_guard_project_move_with_advancements.sql')
        # The trigger comes from 202611080105, whose full file needs the whole
        # schema; recreate just the trigger here.
        db.sql("""
          CREATE TRIGGER guard_project_event_change BEFORE UPDATE OF event_id ON projects
          FOR EACH ROW EXECUTE FUNCTION guard_project_event_change();
        """)
        # Re-running must be safe.
        db.migrate('202611091102_guard_project_move_with_advancements.sql')

        ok, out = db.attempt('authenticated', ORGANIZER_B, move(ADVANCED, EVENT_B))
        checks.expect('advanced project cannot move to another event', ok, False)
        checks.expect('advancement refusal names the reason', 'advanced in judging' in out, True)

        ok, _ = db.attempt('authenticated', ORGANIZER_B, move(WON, EVENT_B))
        checks.expect('prize-winning project still cannot move', ok, False)

        ok, _ = db.attempt('authenticated', ORGANIZER_B, move(ADVANCED, None))
        checks.expect('advanced project can be detached', ok, True)
        ok, out = db.attempt('authenticated', ORGANIZER_B, move(ADVANCED, EVENT_B))
        checks.expect('detach then re-attach does not launder the advancement', ok, False)
        # Re-attaching needs a member of the target event, like any other move.
        ok, _ = db.attempt('authenticated', ORGANIZER_A, move(ADVANCED, EVENT_A))
        checks.expect('re-attaching to the advancement event is allowed', ok, True)

        ok, _ = db.attempt('authenticated', OUTSIDER, move(PLAIN, EVENT_B))
        checks.expect('move into an unjoined event still refused', ok, False)
        ok, _ = db.attempt('authenticated', ORGANIZER_B, move(PLAIN, EVENT_B))
        checks.expect('plain project moves into a joined event', ok, True)
        checks.expect('plain project now in target event', event_of(db, PLAIN), EVENT_B)

        db.sql(f"DELETE FROM events WHERE event_id = '{DELETED_EVENT}'")
        checks.expect('event deletion detaches an advanced project', event_of(db, DELETED_PROJECT), 'null')
    checks.finish()


if __name__ == '__main__':
    main()
