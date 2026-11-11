#!/usr/bin/env python3
"""Offline-only PostgreSQL regression for judge/mentor assignment soft-revoke.

Applies the real migration (202611110201) to a minimal fixture in a disposable
Docker PostgreSQL container. Never accepts a database URL. Requires Docker.
"""
from rls_test_harness import Database, Checks

MIGRATION = "202611110201_revoke_former_mentor_assignments.sql"

E = "00000000-0000-0000-0000-0000000000e1"
E2 = "00000000-0000-0000-0000-0000000000e2"
P1 = "00000000-0000-0000-0000-0000000000a1"
P2 = "00000000-0000-0000-0000-0000000000a2"
MENTOR = "00000000-0000-0000-0000-000000000001"
JUDGE = "00000000-0000-0000-0000-000000000002"
ORGANIZER = "00000000-0000-0000-0000-000000000003"
STALE = "00000000-0000-0000-0000-000000000004"
OTHER_EVENT_MENTOR = "00000000-0000-0000-0000-000000000005"
ADMIN = "00000000-0000-0000-0000-000000000006"

# Only the columns the trigger and backfill touch. The judge trigger from
# 202611080105 is installed verbatim-equivalent so the migration must replace it.
SCHEMA = f"""
CREATE TYPE public.event_role AS ENUM ('participant', 'mentor', 'judge', 'organizer', 'admin');
CREATE TABLE public.user_event_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  role public.event_role NOT NULL,
  UNIQUE (user_id, event_id)
);
CREATE TABLE public.project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  role public.event_role NOT NULL,
  revoked_at timestamptz,
  UNIQUE (project_id, user_id, role)
);
CREATE FUNCTION public.cleanup_former_judge_assignments() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
CREATE TRIGGER cleanup_former_judge_assignments
  AFTER INSERT OR DELETE OR UPDATE OF role, event_id, user_id ON public.user_event_roles
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_former_judge_assignments();

INSERT INTO public.user_event_roles (user_id, event_id, role) VALUES
  ('{MENTOR}', '{E}', 'mentor'),
  ('{JUDGE}', '{E}', 'judge'),
  ('{ORGANIZER}', '{E}', 'organizer'),
  ('{ADMIN}', '{E}', 'admin'),
  ('{STALE}', '{E}', 'participant'),
  ('{OTHER_EVENT_MENTOR}', '{E2}', 'mentor');
INSERT INTO public.project_assignments (project_id, user_id, event_id, role) VALUES
  ('{P1}', '{MENTOR}', '{E}', 'mentor'),
  ('{P2}', '{MENTOR}', '{E}', 'mentor'),
  ('{P1}', '{JUDGE}', '{E}', 'judge'),
  ('{P1}', '{ORGANIZER}', '{E}', 'mentor'),
  ('{P1}', '{ADMIN}', '{E}', 'mentor'),
  ('{P1}', '{STALE}', '{E}', 'mentor'),
  ('{P1}', '{STALE}', '{E}', 'judge'),
  ('{P2}', '{OTHER_EVENT_MENTOR}', '{E2}', 'mentor');
"""


def main():
    checks = Checks()
    with Database("assignment-role-cleanup") as db:
        db.sql(SCHEMA)

        def active(user, role, event=E):
            return db.sql(
                "SELECT count(*) FROM public.project_assignments "
                f"WHERE user_id='{user}' AND event_id='{event}' AND role='{role}' AND revoked_at IS NULL"
            )

        def total(user, role, event=E):
            return db.sql(
                "SELECT count(*) FROM public.project_assignments "
                f"WHERE user_id='{user}' AND event_id='{event}' AND role='{role}'"
            )

        def set_role(user, role, event=E):
            db.sql(f"UPDATE public.user_event_roles SET role='{role}' WHERE user_id='{user}' AND event_id='{event}'")

        # Without the migration, demoting a mentor leaves the assignments active.
        set_role(MENTOR, "participant")
        checks.expect("bug: demoted mentor stays assigned before the fix", active(MENTOR, "mentor"), "2")
        set_role(MENTOR, "mentor")

        db.migrate(MIGRATION)
        db.migrate(MIGRATION)  # Re-running must be safe.

        checks.expect("old judge-only trigger is replaced",
                      db.sql("SELECT string_agg(tgname, ',') FROM pg_trigger "
                             "WHERE tgrelid='public.user_event_roles'::regclass AND NOT tgisinternal"),
                      "sync_role_project_assignments")
        checks.expect("old judge-only function is dropped",
                      db.sql("SELECT to_regproc('public.cleanup_former_judge_assignments') IS NULL"), "t")
        checks.expect("API roles cannot execute the trigger function",
                      db.sql("SELECT has_function_privilege('authenticated', 'public.sync_role_project_assignments()', 'execute')"
                             " OR has_function_privilege('anon', 'public.sync_role_project_assignments()', 'execute')"),
                      "f")

        # Backfill.
        checks.expect("backfill revokes a stale mentor assignment", active(STALE, "mentor"), "0")
        checks.expect("backfill keeps the stale row (soft revoke)", total(STALE, "mentor"), "1")
        checks.expect("backfill leaves judge rows alone", active(STALE, "judge"), "1")
        checks.expect("backfill keeps current mentors", active(MENTOR, "mentor"), "2")
        checks.expect("backfill keeps organizers assigned as mentors", active(ORGANIZER, "mentor"), "1")
        checks.expect("backfill keeps admins assigned as mentors", active(ADMIN, "mentor"), "1")
        checks.expect("backfill keeps other events", active(OTHER_EVENT_MENTOR, "mentor", E2), "1")

        # Demote, restore, move to judge, remove, re-add.
        set_role(MENTOR, "participant")
        checks.expect("demoted mentor loses assignments", active(MENTOR, "mentor"), "0")
        checks.expect("demoted mentor rows are kept", total(MENTOR, "mentor"), "2")
        set_role(MENTOR, "mentor")
        checks.expect("re-promoted mentor gets assignments back", active(MENTOR, "mentor"), "2")
        set_role(MENTOR, "judge")
        checks.expect("mentor moved to judge loses mentor assignments", active(MENTOR, "mentor"), "0")
        set_role(MENTOR, "mentor")
        db.sql(f"DELETE FROM public.user_event_roles WHERE user_id='{MENTOR}' AND event_id='{E}'")
        checks.expect("removed mentor loses assignments", active(MENTOR, "mentor"), "0")
        db.sql(f"INSERT INTO public.user_event_roles (user_id, event_id, role) VALUES ('{MENTOR}', '{E}', 'mentor')")
        checks.expect("re-added mentor gets assignments back", active(MENTOR, "mentor"), "2")
        db.sql(f"UPDATE public.user_event_roles SET role='mentor' WHERE user_id='{MENTOR}' AND event_id='{E}'")
        checks.expect("same-role update changes nothing", active(MENTOR, "mentor"), "2")
        checks.expect("other event is untouched throughout", active(OTHER_EVENT_MENTOR, "mentor", E2), "1")

        # Stale participant made a mentor gets the backfill-revoked row back.
        set_role(STALE, "mentor")
        checks.expect("backfill-revoked row comes back on promotion", active(STALE, "mentor"), "1")

        # Judges behave as before 202611110201.
        set_role(JUDGE, "participant")
        checks.expect("demoted judge loses assignments", active(JUDGE, "judge"), "0")
        set_role(JUDGE, "judge")
        checks.expect("re-promoted judge gets assignments back", active(JUDGE, "judge"), "1")
        set_role(JUDGE, "mentor")
        checks.expect("judge moved to mentor loses judge assignments", active(JUDGE, "judge"), "0")
        checks.expect("judge moved to mentor gains no mentor rows", total(JUDGE, "mentor"), "0")

        # Organizers/admins are not affected by a mentor trigger.
        set_role(ORGANIZER, "admin")
        checks.expect("organizer role change keeps mentor assignments", active(ORGANIZER, "mentor"), "1")
    checks.finish()


if __name__ == "__main__":
    main()
