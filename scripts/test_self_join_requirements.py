#!/usr/bin/env python3
"""Test the self-join trigger migration in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Run from repository root. The schema below is a minimal stand-in for the tables the
trigger reads, with the production policies that allow self-writes.
"""
from pathlib import Path
import time
import uuid

from test_scraper_quota import CONTAINER, docker, sql

MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/202611050003_enforce_self_join_requirements.sql"

SCHEMA = """
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, service_role;

CREATE TYPE public.event_role AS ENUM ('participant', 'mentor', 'judge', 'organizer', 'admin');
CREATE TYPE public.payment_status AS ENUM ('processing', 'paid', 'canceled', 'refunded');
CREATE TYPE public.participant_request_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

CREATE TABLE public.events (
  event_id uuid PRIMARY KEY,
  paid boolean,
  require_participant_approval boolean
);
CREATE TABLE public.user_event_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(event_id),
  role public.event_role NOT NULL,
  updated_at timestamptz,
  UNIQUE (user_id, event_id)
);
CREATE TABLE public.user_event_payments (
  user_id uuid, event_id uuid, payment_status public.payment_status
);
CREATE TABLE public.event_tickets (event_id uuid, assigned_to_user_id uuid);
CREATE TABLE public.participant_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid, user_id uuid,
  requested_role public.event_role NOT NULL DEFAULT 'participant',
  status public.participant_request_status NOT NULL DEFAULT 'pending'
);
CREATE TABLE public.event_intake_form_bindings (
  event_id uuid, context text, form_version_id uuid, is_active boolean
);
CREATE TABLE public.intake_form_submissions (
  event_id uuid, context text, submitter_user_id uuid, status text
);
CREATE TABLE public.admins (user_id uuid);

CREATE FUNCTION public.is_event_organizer(p_event_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS
  $$ SELECT EXISTS (SELECT 1 FROM user_event_roles
                    WHERE event_id = p_event_id AND user_id = p_user_id AND role = 'organizer') $$;
CREATE FUNCTION public.is_admin_user(p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS
  $$ SELECT EXISTS (SELECT 1 FROM admins WHERE user_id = p_user_id) $$;

ALTER TABLE public.user_event_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_select ON public.user_event_roles FOR SELECT USING (true);
CREATE POLICY roles_insert ON public.user_event_roles FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() OR public.is_event_organizer(event_id, auth.uid()) OR public.is_admin_user(auth.uid())
);
CREATE POLICY roles_update ON public.user_event_roles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_event_organizer(event_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_event_organizer(event_id, auth.uid()));

ALTER TABLE public.participant_approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own requests" ON public.participant_approval_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.user_event_roles, public.participant_approval_requests
  TO authenticated, service_role;
"""


def new_event(paid=False, approval=False):
    event = str(uuid.uuid4())
    sql(f"INSERT INTO public.events VALUES ('{event}', {paid}, {approval});")
    return event


def write_as(user, statement):
    """Run one statement as a signed-in user; the transaction is always discarded."""
    return sql(
        f"BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '{user}'; {statement} ROLLBACK;",
        check=False,
    )


def join(user, event, role="participant", target=None):
    return write_as(user, f"INSERT INTO public.user_event_roles (user_id, event_id, role) "
                          f"VALUES ('{target or user}', '{event}', '{role}');")


def assert_allowed(result):
    assert result.returncode == 0, result.stderr


def assert_denied(result, message):
    assert result.returncode != 0 and message in result.stderr, result.stderr


def main():
    migration = MIGRATION.read_text()
    docker("pull", "postgres:16.15", timeout=600)
    try:
        docker("run", "--detach", "--name", CONTAINER, "--network", "none",
               "--tmpfs", "/var/lib/postgresql/data:rw", "--env",
               "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:16.15")
        for _ in range(60):
            if docker("exec", CONTAINER, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", check=False).returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise RuntimeError("Disposable PostgreSQL failed to start")
        sql(SCHEMA)
        sql(migration)
        sql(migration)  # Must be safe to re-run.

        user = str(uuid.uuid4())
        pay_message = "Payment required"

        # Free events stay open, for every role.
        free = new_event()
        assert_allowed(join(user, free))
        assert_allowed(join(user, free, "mentor"))

        # Paid events need a paid payment row or an assigned ticket.
        paid = new_event(paid=True)
        assert_denied(join(user, paid), pay_message)
        assert_denied(join(user, paid, "mentor"), pay_message)
        for status in ("processing", "canceled", "refunded"):
            sql(f"INSERT INTO public.user_event_payments VALUES ('{user}', '{paid}', '{status}');")
        assert_denied(join(user, paid), pay_message)
        sql(f"INSERT INTO public.user_event_payments VALUES ('{user}', '{paid}', 'paid');")
        assert_allowed(join(user, paid))
        assert_allowed(join(user, paid, "mentor"))
        assert_denied(join(str(uuid.uuid4()), paid), pay_message)

        ticketed = new_event(paid=True, approval=True)
        sql(f"INSERT INTO public.event_tickets VALUES ('{ticketed}', '{user}');")
        sql(f"INSERT INTO public.event_intake_form_bindings VALUES ('{ticketed}', 'registration', gen_random_uuid(), true);")
        assert_allowed(join(user, ticketed))  # app/claim-ticket writes the role directly.

        # Approval events need an approved request.
        gated = new_event(approval=True)
        assert_denied(join(user, gated), "approval required")
        sql(f"INSERT INTO public.participant_approval_requests (event_id, user_id, status) VALUES ('{gated}', '{user}', 'pending');")
        assert_denied(join(user, gated), "approval required")
        sql(f"UPDATE public.participant_approval_requests SET status = 'approved' WHERE event_id = '{gated}';")
        assert_allowed(join(user, gated))

        # Paid approval events need both.
        both = new_event(paid=True, approval=True)
        sql(f"INSERT INTO public.participant_approval_requests (event_id, user_id, status) VALUES ('{both}', '{user}', 'approved');")
        assert_denied(join(user, both), pay_message)
        sql(f"INSERT INTO public.user_event_payments VALUES ('{user}', '{both}', 'paid');")
        assert_allowed(join(user, both))

        # A published registration form needs a submitted response.
        form = new_event()
        sql(f"INSERT INTO public.event_intake_form_bindings VALUES ('{form}', 'registration', gen_random_uuid(), true);")
        assert_denied(join(user, form), "questionnaire required")
        assert_allowed(join(user, form, "mentor"))
        sql(f"INSERT INTO public.intake_form_submissions VALUES ('{form}', 'registration', '{user}', 'draft');")
        assert_denied(join(user, form), "questionnaire required")
        sql(f"INSERT INTO public.intake_form_submissions VALUES ('{form}', 'registration', '{user}', 'submitted');")
        assert_allowed(join(user, form))

        # Changing role cannot be used to get around the gate.
        switch = new_event(paid=True)
        judge = str(uuid.uuid4())
        sql(f"INSERT INTO public.user_event_roles (user_id, event_id, role) VALUES ('{judge}', '{switch}', 'judge');")
        assert_denied(write_as(judge, f"UPDATE public.user_event_roles SET role = 'participant' WHERE user_id = '{judge}';"), pay_message)

        # An existing comped member can still touch their own row.
        comped = str(uuid.uuid4())
        sql(f"INSERT INTO public.user_event_roles (user_id, event_id, role) VALUES ('{comped}', '{switch}', 'participant');")
        assert_allowed(write_as(comped, f"UPDATE public.user_event_roles SET updated_at = now() WHERE user_id = '{comped}';"))
        assert_allowed(write_as(comped, f"UPDATE public.user_event_roles SET role = 'participant' WHERE user_id = '{comped}';"))

        # Organizers, admins and the service role can still add or comp people.
        organizer = str(uuid.uuid4())
        admin = str(uuid.uuid4())
        sql(f"INSERT INTO public.user_event_roles (user_id, event_id, role) VALUES ('{organizer}', '{paid}', 'organizer');")
        sql(f"INSERT INTO public.admins VALUES ('{admin}');")
        assert_allowed(join(organizer, paid, target=str(uuid.uuid4())))
        assert_allowed(write_as(organizer, f"UPDATE public.user_event_roles SET role = 'participant' WHERE user_id = '{organizer}';"))
        assert_allowed(join(admin, paid))
        assert_allowed(sql(
            f"BEGIN; SET LOCAL ROLE service_role; INSERT INTO public.user_event_roles (user_id, event_id, role) "
            f"VALUES ('{uuid.uuid4()}', '{paid}', 'participant'); ROLLBACK;", check=False))

        # Users cannot self-approve to satisfy the approval check.
        request = "INSERT INTO public.participant_approval_requests (event_id, user_id, status) VALUES ('{}', '{}', '{}');"
        fresh = new_event(approval=True)
        assert_denied(write_as(user, request.format(fresh, user, "approved")), "row-level security")
        assert_allowed(write_as(user, request.format(fresh, user, "pending")))

        print("PASS: self-joins need payment, approval and questionnaire; trusted writers and existing members are unaffected")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
