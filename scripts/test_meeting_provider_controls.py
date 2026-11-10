#!/usr/bin/env python3
"""Disposable SQL test of server-only meeting provisioning/provider fields."""
from rls_test_harness import Checks, Database

USER = '00000000-0000-0000-0000-000000000001'
MEETING = '00000000-0000-0000-0000-000000000002'

def main():
    checks = Checks()
    with Database('meeting-provider-controls') as db:
        db.sql(f"""
          CREATE ROLE service_role NOLOGIN BYPASSRLS;
          CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
          CREATE TABLE public.meetings(id uuid PRIMARY KEY,user_id uuid,transcript_url text,recording_url text);
          GRANT ALL ON public.meetings TO authenticated,service_role;
          GRANT USAGE ON SCHEMA auth TO service_role;
          INSERT INTO public.meetings(id,user_id) VALUES ('{MEETING}','{USER}');
        """)
        db.migrate('202611060401_protect_meeting_provider_urls.sql')
        for field, value in [('transcript_url', "'https://attacker.invalid/file'"), ('recording_url', "'https://attacker.invalid/file'"), ('provisioning_failed', 'true')]:
            ok, _ = db.attempt('authenticated', USER, f'UPDATE meetings SET {field}={value}')
            checks.expect(f'client cannot set {field}', ok, False)
            ok, _ = db.attempt('service_role', None, f'UPDATE meetings SET {field}={value}')
            checks.expect(f'service can set {field}', ok, True)
        ok, _ = db.attempt('authenticated', USER, 'DELETE FROM meetings WHERE provisioning_failed')
        checks.expect('client cannot delete reconciliation record', ok, False)
        ok, _ = db.attempt('service_role', None, 'DELETE FROM meetings WHERE provisioning_failed')
        checks.expect('service can reconcile and remove failed record', ok, True)
        ok, _ = db.attempt('authenticated', USER, f"INSERT INTO meetings(id,user_id,transcript_url) VALUES(gen_random_uuid(),'{USER}','https://attacker.invalid')")
        checks.expect('client cannot inject URL during insert', ok, False)
        ok, _ = db.attempt('authenticated', USER, f"INSERT INTO meetings(id,user_id) VALUES(gen_random_uuid(),'{USER}')")
        checks.expect('normal meeting creation remains available', ok, True)
    checks.finish()

if __name__ == '__main__':
    main()
