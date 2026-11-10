#!/usr/bin/env python3
"""Admission regression tests. Uses disposable Docker only, never a supplied DB URL."""
from concurrent.futures import ThreadPoolExecutor
from rls_test_harness import Checks, Database

USER = '00000000-0000-0000-0000-000000000001'
OTHER = '00000000-0000-0000-0000-000000000002'
EVENT = '00000000-0000-0000-0000-000000000003'
SCHEMA = f"""
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA auth TO service_role;
CREATE TYPE public.event_role AS ENUM ('participant', 'organizer');
CREATE TYPE public.approval_status AS ENUM ('not_submitted', 'submitted', 'approved', 'rejected');
CREATE TABLE public.events(event_id uuid PRIMARY KEY, owner_id uuid, participant_capacity int,
 approval_status public.approval_status DEFAULT 'not_submitted', featured boolean DEFAULT false);
CREATE TABLE public.user_event_roles(id uuid DEFAULT gen_random_uuid() PRIMARY KEY, event_id uuid,
 user_id uuid, role public.event_role, UNIQUE(event_id,user_id));
CREATE TABLE public.user_event_payments(id uuid DEFAULT gen_random_uuid(), user_id uuid, payment_status text);
CREATE TABLE public.role_passwords(event_id uuid, role text, password_hash text, UNIQUE(event_id,role));
CREATE FUNCTION public.is_admin_user(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION public.is_event_organizer(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
ALTER TABLE public.user_event_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_event_roles ENABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
CREATE POLICY "Users can create own payments" ON public.user_event_payments FOR INSERT WITH CHECK(auth.uid()=user_id);
CREATE POLICY "Users can update own payments" ON public.user_event_payments FOR UPDATE USING(auth.uid()=user_id);
CREATE POLICY read_payments ON public.user_event_payments FOR SELECT USING(auth.uid()=user_id);
CREATE POLICY read_passwords ON public.role_passwords FOR SELECT USING(true);
CREATE POLICY "Users, organizers, and admins can assign roles to events" ON public.user_event_roles FOR INSERT WITH CHECK(auth.uid()=user_id);
INSERT INTO events(event_id, owner_id, participant_capacity) VALUES ('{EVENT}','{USER}',1);
INSERT INTO user_event_payments(user_id,payment_status) VALUES ('{USER}','processing');
INSERT INTO role_passwords VALUES ('{EVENT}','participant','synthetic-not-a-real-hash');
"""


def main():
    checks = Checks()
    with Database('admission-security') as db:
        db.sql(SCHEMA)
        ok, _ = db.attempt('authenticated', USER, "UPDATE user_event_payments SET payment_status='paid'")
        checks.expect('baseline payment forgery succeeds before hardening', ok, True)
        ok, _ = db.attempt('authenticated', USER, 'SELECT password_hash FROM role_passwords')
        checks.expect('baseline password hash exposure reproduced', ok, True)
        db.migrate('20250818_enforce_participant_capacity_trigger.sql', '202611060101_harden_admission_permissions.sql')
        denied = [
            ('cannot forge paid status', "UPDATE user_event_payments SET payment_status='paid'"),
            ('cannot insert forged payment', f"INSERT INTO user_event_payments(user_id,payment_status) VALUES ('{USER}','paid')"),
            ('cannot directly self-enroll', f"INSERT INTO user_event_roles(event_id,user_id,role) VALUES ('{EVENT}','{USER}','participant')"),
            ('cannot read password hashes', 'SELECT password_hash FROM role_passwords'),
            ('cannot approve own event', "UPDATE events SET approval_status='approved'"),
            ('cannot feature own event', 'UPDATE events SET featured=true'),
            ('cannot insert approved event', f"INSERT INTO events(event_id,owner_id,approval_status) VALUES (gen_random_uuid(),'{USER}','approved')"),
        ]
        for label, sql in denied:
            ok, _ = db.attempt('authenticated', USER, sql)
            checks.expect(label, ok, False)
        for label, sql in [
            ('password metadata still readable', 'SELECT event_id,role FROM role_passwords'),
            ('owner may request review', "UPDATE events SET approval_status='submitted'"),
            ('ordinary event edit still allowed', 'UPDATE events SET participant_capacity=1'),
        ]:
            ok, _ = db.attempt('authenticated', USER, sql)
            checks.expect(label, ok, True)
        ok, output = db.attempt('service_role', None, "UPDATE events SET approval_status='approved',featured=true")
        checks.expect('trusted moderation still allowed' + ('' if ok else ': '+output), ok, True)
        ok, _ = db.attempt('service_role', None, f"INSERT INTO role_passwords(event_id,role,password_hash) VALUES ('{EVENT}','participant','replacement-synthetic-hash') ON CONFLICT(event_id,role) DO UPDATE SET password_hash=excluded.password_hash")
        checks.expect('trusted password writer can upsert after hash SELECT revoked', ok, True)
        checks.expect('password update persisted', db.sql("SELECT password_hash FROM role_passwords"), 'replacement-synthetic-hash')
        # The first transaction holds the event lock while the second attempts
        # its last-seat insert. READ COMMITTED must count the committed first row.
        import time
        def enroll(user, delay):
            return db._psql(f"BEGIN; INSERT INTO user_event_roles(event_id,user_id,role) VALUES ('{EVENT}','{user}','participant'); SELECT pg_sleep({delay}); COMMIT;")
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(enroll, USER, 1)
            time.sleep(0.2)
            second = pool.submit(enroll, OTHER, 0)
            results = [first.result(), second.result()]
        checks.expect('only one competing last-seat insert succeeds', sum(x.returncode == 0 for x in results), 1)
        checks.expect('capacity remains one', db.sql('SELECT count(*) FROM user_event_roles'), '1')
    checks.finish()

if __name__ == '__main__':
    main()
