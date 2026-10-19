#!/usr/bin/env python3
"""Internal assertions for the fresh offline container owned by test_meeting_database.py.
Uses checked-in migrations and a reduced synthetic dependency fixture.
"""
import concurrent.futures, json, pathlib, subprocess
ROOT = pathlib.Path(__file__).resolve().parent

def run_assertions(container: str, repo: pathlib.Path):
    if not container.startswith('mentormates-security-tests'):
        raise SystemExit('Only explicit mentormates-security-tests disposable containers accepted')
    info = json.loads(subprocess.check_output(['docker','inspect',container]))[0]
    config = info['HostConfig']
    if config['NetworkMode'] != 'none' or config.get('PortBindings') or '/var/lib/postgresql/data' not in config.get('Tmpfs', {}):
        raise SystemExit('Container must have network none, no published ports, and tmpfs data')
    db = 'meeting_boundary_test'
    def sql(text, expected=True, database=db, sqlstate=None):
        result = subprocess.run(['docker','exec','-i',container,'psql','-h','127.0.0.1','-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At','-U','postgres','-d',database],input=text,text=True,capture_output=True,timeout=90)
        if (result.returncode == 0) != expected:
            raise AssertionError(result.stdout + result.stderr)
        if sqlstate and sqlstate not in result.stderr:
            raise AssertionError("Wrong failure reason: " + result.stderr)
        return result.stdout.strip()
    # Refuse existing database rather than deleting any previous data.
    sql('CREATE DATABASE '+db, database='postgres')
    sql((ROOT/'fixture.sql').read_text())
    for name in ['20260105_agents.sql','20260105_meetings.sql','20251029_project_rls.sql','20260206_add_auto_conversations_on_join.sql']:
        sql((repo/'supabase/migrations'/name).read_text())
    sql((ROOT/'seed.sql').read_text())
    # Refuse restrictive activation before the additive helper exists.
    sql((repo/'supabase/migrations/202610200003_restrict_meetings.sql').read_text(),False,sqlstate='P0001')
    sql((repo/'supabase/migrations/202610200002_meeting_timeline_projection.sql').read_text())
    sql((repo/'supabase/migrations/202610200003_restrict_meetings.sql').read_text())
    sql((repo/'supabase/migrations/202610200003_restrict_meetings.sql').read_text()) # repeat-safe migration
    def as_user(user, statement, expected=True, role='authenticated', sqlstate=None):
        uid = f'00000000-0000-4000-8000-{user:012}' if user else ''
        return sql(f"SET ROLE {role}; SET request.jwt.claim.sub='{uid}'; {statement}",expected,sqlstate=sqlstate)
    meeting="'40000000-0000-4000-8000-000000000001'"
    # SQL assertions throw on mismatch without relying on textual command tags.
    def assert_count(user, count, where='true'):
        as_user(user,f"DO $$ BEGIN IF (SELECT count(*) FROM public.meetings WHERE {where}) <> {count} THEN RAISE EXCEPTION 'row visibility mismatch'; END IF; END $$;")
    assert_count(1,3)
    assert_count(2,0) # project teammate: metadata only
    assert_count(3,1) # event owner
    assert_count(4,1) # event organizer
    assert_count(5,0) # wrong event
    assert_count(6,1) # event admin
    assert_count(7,0) # outsider
    assert_count(9,1) # admin still cannot read standalone
    as_user(None,'SELECT * FROM public.meetings;',False,'anon')
    timeline="public.project_meeting_timeline('20000000-0000-4000-8000-000000000001')"
    as_user(2,f"DO $$ BEGIN IF (SELECT count(*) FROM {timeline})<>1 OR (SELECT bool_or(can_view_details) FROM {timeline}) THEN RAISE EXCEPTION 'timeline mismatch'; END IF; END $$;")
    as_user(5,f'SELECT * FROM {timeline}',False)
    as_user(None,f'SELECT * FROM {timeline}',False,'anon')
    as_user(2,f'SELECT summary FROM {timeline}',False)
    as_user(1,f"UPDATE public.meetings SET name='Renamed' WHERE id={meeting};")
    for column,value in [('status',"'completed'"),('summary',"'forged'"),('score','100'),('user_id',"'00000000-0000-4000-8000-000000000002'"),('updated_at','now()')]:
        as_user(1,f'UPDATE public.meetings SET {column}={value} WHERE id={meeting}',False)
    as_user(1,"INSERT INTO public.meetings(name,user_id,agent_id,event_id,project_id) VALUES ('Legit','00000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');")
    as_user(1,"INSERT INTO public.meetings(name,status) VALUES ('Forged','completed');",False)
    as_user(1,f"UPDATE public.meetings SET event_id='10000000-0000-4000-8000-000000000002' WHERE id={meeting};",False)
    # Expanded real-role matrix: projection authorization and effective ACLs.
    standalone="public.project_meeting_timeline('20000000-0000-4000-8000-000000000002')"
    public_project="public.project_meeting_timeline('20000000-0000-4000-8000-000000000003')"
    as_user(2,f"DO $$ BEGIN IF (SELECT count(*) FROM {standalone})<>1 THEN RAISE EXCEPTION 'standalone teammate metadata missing'; END IF; END $$;")
    as_user(7,f'SELECT * FROM {standalone}',False)
    as_user(9,f'SELECT * FROM {standalone}',False) # standalone admin is not project member
    as_user(7,f"DO $$ BEGIN IF (SELECT count(*) FROM {public_project})<>1 THEN RAISE EXCEPTION 'public project metadata missing'; END IF; END $$;")
    as_user(None,f'SELECT * FROM {public_project}',False,'anon')
    as_user(1,"SELECT * FROM public.project_meeting_timeline('20000000-0000-4000-8000-000000000099');",False)
    as_user(None,f'SELECT * FROM {timeline}',False) # authenticated DB role with no identity
    as_user(2,f'SELECT transcript_url FROM {timeline}',False)
    as_user(2,f'SELECT recording_url FROM {timeline}',False)
    as_user(1,f"DO $$ BEGIN IF NOT (SELECT bool_and(can_view_details) FROM {timeline}) THEN RAISE EXCEPTION 'owner link denied'; END IF; END $$;")
    as_user(None,'SELECT summary FROM public.meetings;',False,'anon')
    # Prefix checks prevent blanket table rights reappearing as new columns are added.
    sql("""DO $$ BEGIN
      IF has_table_privilege('authenticated','public.meetings','UPDATE') OR
         has_table_privilege('authenticated','public.meetings','INSERT') OR
         has_column_privilege('authenticated','public.meetings','status','UPDATE') OR
         has_column_privilege('anon','public.meetings','summary','SELECT') THEN
        RAISE EXCEPTION 'broad or stale column grants survived';
      END IF;
    END $$;""")
    def insert(user=1,agent=2,event=None,project=None,owner=None,extra=None,ok=True):
        fields=['name','user_id','agent_id','event_id','project_id']
        values=["'Matrix insert'",f"'00000000-0000-4000-8000-{owner or user:012}'",f"'30000000-0000-4000-8000-{agent:012}'",
                f"'10000000-0000-4000-8000-{event:012}'" if event else 'NULL',
                f"'20000000-0000-4000-8000-{project:012}'" if project else 'NULL']
        if extra:
            fields.append(extra[0]); values.append(extra[1])
        return as_user(user,'INSERT INTO public.meetings('+','.join(fields)+') VALUES ('+','.join(values)+') RETURNING id;',ok,sqlstate=None if ok else '42501')
    insert(owner=2,ok=False) # spoofed owner
    for column,value in [('id',"'40000000-0000-4000-8000-000000000099'"),('status',"'completed'"),
                         ('score','100'),('summary',"'forged'"),('category_scores',"'{}'::jsonb"),
                         ('transcript_url',"'https://example.test/forged'"),('recording_url',"'https://example.test/forged'"),
                         ('created_at','now()'),('updated_at','now()'),('started_at','now()'),('ended_at','now()')]:
        insert(extra=(column,value),ok=False)
        as_user(1,f'UPDATE public.meetings SET {column}={value} WHERE id={meeting} RETURNING id;',False,sqlstate='42501')
    insert(agent=6) # null enabled retains current UI behavior
    insert(agent=7) # caller-owned event agent remains usable standalone
    insert(agent=2) # global standalone
    insert(agent=2,event=1) # global in accessible event
    insert(agent=1,event=1,project=1) # primary event + team project
    insert(agent=4,event=1,project=1) # junction association
    insert(agent=3,event=1,ok=False) # unrelated event agent
    insert(agent=1,ok=False) # cannot strip another event agent context
    insert(agent=5,ok=False) # disabled
    insert(agent=99,ok=False) # absent agent
    insert(agent=2,event=2,ok=False) # no event membership
    insert(agent=2,event=99,ok=False) # missing event
    insert(agent=2,event=1,project=2,ok=False) # contradictory project event
    insert(user=7,agent=2,project=2,ok=False) # private project nonmember
    insert(user=7,agent=2,project=3,ok=False) # public readability is not write provenance
    insert(user=2,agent=1,event=1,project=1) # teammate can create own session
    # Other-user UPDATE returns no rows, owner edit continues after agent disabled.
    as_user(7,f"DO $$ BEGIN UPDATE public.meetings SET name='forged' WHERE id={meeting}; IF FOUND THEN RAISE EXCEPTION 'nonowner update'; END IF; END $$;")
    sql("UPDATE public.agents SET enabled=false WHERE id='30000000-0000-4000-8000-000000000001';")
    as_user(1,f"UPDATE public.meetings SET name='Legacy rename' WHERE id={meeting};")
    as_user(1,f"UPDATE public.meetings SET agent_id='30000000-0000-4000-8000-000000000005' WHERE id={meeting};",False)
    as_user(1,f"UPDATE public.meetings SET agent_id='30000000-0000-4000-8000-000000000002' WHERE id={meeting};")
    # Service role still writes all processing fields; client cannot reset afterward.
    # Real PostgreSQL row-lock/conditional UPDATE semantics, via service role.
    def claim(_):
        return sql(f"SET ROLE service_role; UPDATE public.meetings SET status='processing' WHERE id={meeting} AND status='upcoming' RETURNING id;")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        winners=sum('40000000-0000-4000-8000-000000000001' in value for value in pool.map(claim,range(16)))
    assert winners == 1, winners
    as_user(1,f"UPDATE public.meetings SET status='upcoming' WHERE id={meeting}",False)
    sql(f"SET ROLE service_role; UPDATE public.meetings SET status='completed',summary='Server summary',score=90 WHERE id={meeting};")
    # Historical SECURITY DEFINER RPC cannot bypass INSERT ownership/column ACLs.
    auto_rpc="public.create_auto_conversations_for_event_role('00000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','participant')"
    as_user(1,'SELECT '+auto_rpc,False,sqlstate='42501')
    as_user(None,'SELECT '+auto_rpc,False,'anon',sqlstate='42501')
    sql("""DO $$ BEGIN
      IF has_function_privilege('authenticated','public.create_auto_conversations_for_event_role(uuid,uuid,public.event_role)','EXECUTE') OR
         has_function_privilege('anon','public.create_auto_conversations_for_event_role(uuid,uuid,public.event_role)','EXECUTE') OR
         NOT has_function_privilege('service_role','public.create_auto_conversations_for_event_role(uuid,uuid,public.event_role)','EXECUTE') THEN
        RAISE EXCEPTION 'auto-conversation RPC execution ACL incorrect';
      END IF;
    END $$;""")
    # Exercise the ACTUAL historical role trigger, not a test substitute.
    sql("""UPDATE public.events SET session_caps='{"auto_conversations":{"participant":["30000000-0000-4000-8000-000000000001"]}}'::jsonb
      WHERE event_id='10000000-0000-4000-8000-000000000001';
      UPDATE public.agents SET enabled=true WHERE id='30000000-0000-4000-8000-000000000001';
      SET ROLE service_role;
      INSERT INTO public.user_event_roles(user_id,event_id,role) VALUES
      ('00000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','participant');
      RESET ROLE;
      DO $$ BEGIN
       IF (SELECT count(*) FROM public.meetings WHERE user_id='00000000-0000-4000-8000-000000000007'
           AND event_id='10000000-0000-4000-8000-000000000001'
           AND agent_id='30000000-0000-4000-8000-000000000001' AND status='upcoming' AND name='TODO: Event agent') <> 1 THEN
         RAISE EXCEPTION 'historical role trigger no longer creates intended TODO';
       END IF;
      END $$;
      SET ROLE service_role;
      SELECT public.create_auto_conversations_for_event_role('00000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','participant');
      RESET ROLE;
      DO $$ BEGIN
       IF (SELECT count(*) FROM public.meetings WHERE user_id='00000000-0000-4000-8000-000000000007'
           AND event_id='10000000-0000-4000-8000-000000000001') <> 1 THEN RAISE EXCEPTION 'server retry duplicated TODO'; END IF;
      END $$;""")
    # Unknown policy preflight must fail, not leave a broad policy silently active.
    sql('CREATE POLICY unexpected_test_policy ON public.meetings FOR SELECT USING(true);')
    sql((repo/'supabase/migrations/202610200003_restrict_meetings.sql').read_text(),False)
    sql("""DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meetings' AND policyname='unexpected_test_policy') OR
         NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meetings' AND policyname='meetings_read_authorized') OR
         has_column_privilege('authenticated','public.meetings','status','UPDATE') THEN
        RAISE EXCEPTION 'preflight transaction did not preserve prior state';
      END IF;
    END $$;""")
    sql('DROP POLICY unexpected_test_policy ON public.meetings;')
    # Denied DELETE and UPDATE are row-filtering, not necessarily SQL errors.
    as_user(7,f"DO $$ BEGIN DELETE FROM public.meetings WHERE id={meeting}; IF FOUND THEN RAISE EXCEPTION 'outsider deleted meeting'; END IF; END $$;")
    as_user(3,f"DO $$ BEGIN UPDATE public.meetings SET name='event owner edit' WHERE id={meeting}; IF FOUND THEN RAISE EXCEPTION 'event owner should not edit another owner metadata'; END IF; END $$;")
    as_user(1,"DO $$ BEGIN DELETE FROM public.meetings WHERE id='40000000-0000-4000-8000-000000000003'; IF NOT FOUND THEN RAISE EXCEPTION 'owner delete failed'; END IF; END $$;")
    print('PASS: migration ACL/RLS/association/projection/CAS smoke checks (reduced fixture)')
    print('No production database touched; caller will dispose the container.')

