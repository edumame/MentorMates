#!/usr/bin/env python3
"""Test the event role policies in a disposable PostgreSQL container.

Applies the previous policies and then the real migration, so a policy name that
fails to drop shows up here as an attack that still succeeds.
"""
from rls_test_harness import Checks, Database

ATTACKER = "00000000-0000-0000-0000-00000000000a"
ORGANIZER = "00000000-0000-0000-0000-00000000000b"
MEMBER = "00000000-0000-0000-0000-00000000000c"
EVENT = "00000000-0000-0000-0000-0000000000e1"

SCHEMA = f"""
CREATE TABLE public.user_event_roles (
  user_id uuid NOT NULL, event_id uuid NOT NULL, role text NOT NULL,
  updated_at timestamptz, PRIMARY KEY (user_id, event_id)
);
CREATE TABLE public.participant_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL,
  user_id uuid NOT NULL, requested_role text NOT NULL DEFAULT 'participant',
  status text NOT NULL DEFAULT 'pending'
);
ALTER TABLE public.user_event_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_approval_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_event_roles, public.participant_approval_requests TO authenticated;
CREATE FUNCTION public.is_event_organizer(p_event_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_event_roles
                 WHERE event_id = p_event_id AND user_id = p_user_id AND role = 'organizer')
$$;
CREATE FUNCTION public.is_admin_user(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE POLICY "Read roles" ON public.user_event_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own requests" ON public.participant_approval_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
INSERT INTO public.user_event_roles (user_id, event_id, role) VALUES
  ('{ORGANIZER}', '{EVENT}', 'organizer'),
  ('{MEMBER}', '{EVENT}', 'participant');
"""


def insert_role(user, role):
    return f"INSERT INTO public.user_event_roles (user_id, event_id, role) VALUES ('{user}', '{EVENT}', '{role}')"


def main():
    checks = Checks()
    with Database("role-rls") as db:
        db.sql(SCHEMA)
        db.migrate("20251106_admin_edit_user_event_roles.sql")

        ok, _ = db.attempt("authenticated", ATTACKER, f"{insert_role(ATTACKER, 'organizer')} RETURNING 1")
        checks.expect("before: the self-promotion attack works (test can detect it)", ok, True)
        db.sql(f"DELETE FROM public.user_event_roles WHERE user_id = '{ATTACKER}'")

        db.migrate("202611030001_restrict_event_role_self_service.sql")

        for role in ("organizer", "judge", "mentor", "admin"):
            ok, _ = db.attempt("authenticated", ATTACKER, insert_role(ATTACKER, role))
            checks.expect(f"attacker cannot self-insert {role}", ok, False)

        promote = f"""
          INSERT INTO public.user_event_roles (user_id, event_id, role)
          VALUES ('{MEMBER}', '{EVENT}', 'organizer')
          ON CONFLICT (user_id, event_id) DO UPDATE SET role = 'organizer'
        """
        ok, _ = db.attempt("authenticated", MEMBER, promote)
        checks.expect("participant cannot upsert themselves to organizer", ok, False)

        db.attempt("authenticated", MEMBER,
                   f"UPDATE public.user_event_roles SET role = 'organizer' WHERE user_id = '{MEMBER}'")
        role = db.sql(f"SELECT role FROM public.user_event_roles WHERE user_id = '{MEMBER}'")
        checks.expect("participant cannot update themselves to organizer", role, "participant")

        ok, _ = db.attempt("authenticated", ATTACKER, insert_role(MEMBER, "participant"))
        checks.expect("attacker cannot insert a row for someone else", ok, False)

        ok, _ = db.attempt("anon", None, insert_role(ATTACKER, "participant"))
        checks.expect("anonymous visitors cannot insert roles", ok, False)

        approved = f"""
          INSERT INTO public.participant_approval_requests (event_id, user_id, status)
          VALUES ('{EVENT}', '{ATTACKER}', 'approved')
        """
        ok, _ = db.attempt("authenticated", ATTACKER, approved)
        checks.expect("users cannot create an already-approved request", ok, False)

        ok, _ = db.attempt("authenticated", ATTACKER, approved.replace("'approved'", "'pending'"))
        checks.expect("users can still create a pending request", ok, True)

        ok, _ = db.attempt("authenticated", ATTACKER, insert_role(ATTACKER, "participant"))
        checks.expect("users can still self-join as participant", ok, True)

        ok, _ = db.attempt("authenticated", ORGANIZER, insert_role(
            "00000000-0000-0000-0000-00000000000d", "judge"))
        checks.expect("organizers can still assign roles in their event", ok, True)

        db.attempt("authenticated", ORGANIZER,
                   f"UPDATE public.user_event_roles SET role = 'mentor' WHERE user_id = '{MEMBER}'")
        role = db.sql(f"SELECT role FROM public.user_event_roles WHERE user_id = '{MEMBER}'")
        checks.expect("organizers can still change roles in their event", role, "mentor")

        db.attempt("authenticated", MEMBER,
                   f"DELETE FROM public.user_event_roles WHERE user_id = '{MEMBER}'")
        count = db.sql(f"SELECT count(*) FROM public.user_event_roles WHERE user_id = '{MEMBER}'")
        checks.expect("users can still leave an event", count, "0")
    checks.finish()


if __name__ == "__main__":
    main()
