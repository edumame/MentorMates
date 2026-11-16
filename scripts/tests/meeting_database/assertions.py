#!/usr/bin/env python3
"""Internal assertions for the fresh offline container owned by test_meeting_database.py.
Uses checked-in migrations and a reduced synthetic dependency fixture.

Users (00000000-0000-4000-8000-0000000000NN):
  1 meeting owner, project lead     2 teammate          3 event owner
  4 event organizer                 5 other-event organizer
  6 event 'admin' role              7 outsider          8 other-event owner
  9 platform admin                  10 judge
"""
import concurrent.futures, json, pathlib, subprocess
ROOT = pathlib.Path(__file__).resolve().parent
MIGRATION = '202611110401_meeting_timeline_and_client_limits.sql'
# Everything in main that shapes meetings access, in filename order.
BASE_MIGRATIONS = ['20260105_agents.sql', '20260105_meetings.sql', '20251029_project_rls.sql',
                   '20260206_add_auto_conversations_on_join.sql', '20260211_agent_events.sql',
                   '202611030002_restrict_meeting_agent_reads.sql',
                   '202611060401_protect_meeting_provider_urls.sql',
                   '202611091101_auto_conversations_linked_agents.sql']

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
            raise AssertionError(text[:300] + '\n' + result.stdout + result.stderr)
        if sqlstate and sqlstate not in result.stderr:
            raise AssertionError("Wrong failure reason: " + result.stderr)
        return result.stdout.strip()
    def migration(name):
        return (repo/'supabase/migrations'/name).read_text()
    # Refuse existing database rather than deleting any previous data.
    sql('CREATE DATABASE '+db, database='postgres')
    sql((ROOT/'fixture.sql').read_text())
    for name in BASE_MIGRATIONS:
        sql(migration(name))
    sql((ROOT/'seed.sql').read_text())
    def as_user(user, statement, expected=True, role='authenticated', sqlstate=None):
        uid = f'00000000-0000-4000-8000-{user:012}' if user else ''
        return sql(f"SET ROLE {role}; SET request.jwt.claim.sub='{uid}'; {statement}",expected,sqlstate=sqlstate)
    meeting="'40000000-0000-4000-8000-000000000001'"
    # SQL assertions throw on mismatch without relying on textual command tags.
    def assert_count(user, count, where='true', label='row visibility mismatch'):
        as_user(user,f"DO $$ BEGIN IF (SELECT count(*) FROM public.meetings WHERE {where}) <> {count} THEN RAISE EXCEPTION '{label}'; END IF; END $$;")

    # Before: main's interim policy lets teammates and judges read full rows.
    assert_count(2,2,"summary='PRIVATE_SUMMARY'",'expected teammate to read summaries before the fix')
    assert_count(10,1,"summary='PRIVATE_SUMMARY'",'expected judge to read summaries before the fix')

    sql(migration(MIGRATION))
    sql(migration(MIGRATION)) # repeat-safe

    # Full rows: owner and event staff only.
    assert_count(1,3)
    assert_count(2,0) # teammate: timeline only
    assert_count(3,1) # event owner
    assert_count(4,1) # event organizer
    assert_count(5,0) # other event's organizer
    assert_count(6,1) # event admin role
    assert_count(7,0) # outsider
    assert_count(9,1) # platform admin: event meetings, not standalone ones
    assert_count(10,0) # judge: timeline only
    as_user(None,'SELECT * FROM public.meetings;',False,'anon')
    as_user(None,'SELECT summary FROM public.meetings;',False,'anon')
    sql("""DO $$ BEGIN
      IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meetings'
                AND policyname='Owners, teammates and event staff can read meetings') THEN
        RAISE EXCEPTION 'interim teammate read policy survived';
      END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='protect_meeting_provider_urls'
                    AND tgrelid='public.meetings'::regclass) THEN
        RAISE EXCEPTION 'main provider URL trigger lost';
      END IF;
    END $$;""")

    # Timeline: metadata for owner, teammates, judges and event staff.
    timeline="public.project_meeting_timeline('20000000-0000-4000-8000-000000000001')"
    standalone="public.project_meeting_timeline('20000000-0000-4000-8000-000000000002')"
    public_project="public.project_meeting_timeline('20000000-0000-4000-8000-000000000003')"
    def assert_timeline(user, fn, rows, details=None):
        check = f"(SELECT count(*) FROM {fn})<>{rows}"
        if details is not None:
            check += f" OR (SELECT bool_and(can_view_details) FROM {fn}) IS DISTINCT FROM {str(details).lower()}"
        as_user(user,f"DO $$ BEGIN IF {check} THEN RAISE EXCEPTION 'timeline mismatch user {user}'; END IF; END $$;")
    assert_timeline(1,timeline,1,True)
    assert_timeline(2,timeline,1,False)
    assert_timeline(10,timeline,1,False)
    for staff in (3,4,6,9):
        assert_timeline(staff,timeline,1,True)
    for nobody in (5,7,8):
        assert_timeline(nobody,timeline,0)
    assert_timeline(1,standalone,1,True)
    assert_timeline(2,standalone,1,False)
    assert_timeline(7,standalone,0)
    assert_timeline(9,standalone,0) # admin is not on the standalone project
    assert_timeline(1,public_project,1,True)
    assert_timeline(7,public_project,0) # a public project doesn't publish its sessions
    assert_timeline(1,"public.project_meeting_timeline('20000000-0000-4000-8000-000000000099')",0)
    as_user(None,f'SELECT * FROM {timeline}',False,sqlstate='42501') # authenticated role, no identity
    as_user(None,f'SELECT * FROM {timeline}',False,'anon')
    for column in ('summary','transcript_url','recording_url','user_id','category_scores'):
        as_user(2,f'SELECT {column} FROM {timeline}',False)
    # A meeting whose event differs from its project's event stays off the timeline.
    sql("INSERT INTO public.meetings(id,user_id,agent_id,event_id,project_id,name) VALUES ('40000000-0000-4000-8000-000000000098','00000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Mismatched');")
    assert_timeline(2,timeline,1)
    sql("DELETE FROM public.meetings WHERE id='40000000-0000-4000-8000-000000000098';")

    # Client write limits.
    sql("""DO $$ BEGIN
      IF has_table_privilege('authenticated','public.meetings','UPDATE') OR
         has_table_privilege('authenticated','public.meetings','INSERT') OR
         has_column_privilege('authenticated','public.meetings','status','UPDATE') OR
         has_column_privilege('authenticated','public.meetings','status','INSERT') OR
         has_column_privilege('anon','public.meetings','summary','SELECT') OR
         has_column_privilege('anon','public.meetings','score','UPDATE') OR
         NOT has_column_privilege('authenticated','public.meetings','name','UPDATE') OR
         NOT has_table_privilege('service_role','public.meetings','UPDATE') THEN
        RAISE EXCEPTION 'broad or stale column grants survived';
      END IF;
    END $$;""")
    as_user(1,f"UPDATE public.meetings SET name='Renamed' WHERE id={meeting};")
    def insert(user=1,agent=2,event=None,project=None,owner=None,extra=None,ok=True):
        fields=['name','user_id','agent_id','event_id','project_id']
        values=["'Matrix insert'",f"'00000000-0000-4000-8000-{owner or user:012}'",f"'30000000-0000-4000-8000-{agent:012}'",
                f"'10000000-0000-4000-8000-{event:012}'" if event else 'NULL',
                f"'20000000-0000-4000-8000-{project:012}'" if project else 'NULL']
        if extra:
            fields.append(extra[0]); values.append(extra[1])
        # RETURNING * is what the app's insert().select() does.
        return as_user(user,'INSERT INTO public.meetings('+','.join(fields)+') VALUES ('+','.join(values)+') RETURNING *;',ok,sqlstate=None if ok else '42501')
    insert(owner=2,ok=False) # spoofed owner
    for column,value in [('id',"'40000000-0000-4000-8000-000000000099'"),('status',"'completed'"),
                         ('score','100'),('summary',"'forged'"),('category_scores',"'{}'::jsonb"),
                         ('transcript_url',"'https://example.test/forged'"),('recording_url',"'https://example.test/forged'"),
                         ('provisioning_failed','true'),
                         ('created_at','now()'),('updated_at','now()'),('started_at','now()'),('ended_at','now()')]:
        insert(extra=(column,value),ok=False)
        as_user(1,f'UPDATE public.meetings SET {column}={value} WHERE id={meeting} RETURNING id;',False,sqlstate='42501')
    as_user(1,f"UPDATE public.meetings SET user_id='00000000-0000-4000-8000-000000000002' WHERE id={meeting}",False,sqlstate='42501')

    # Association rules.
    insert(agent=6) # null enabled keeps working
    insert(agent=7) # caller-owned event agent usable standalone
    insert(agent=2) # platform agent, standalone
    insert(agent=2,event=1) # platform agent in the caller's event
    insert(agent=1,event=1,project=1) # event agent + team project
    insert(agent=4,event=1,project=1) # agent linked through agent_events
    insert(user=2,agent=1,event=1,project=1) # teammate's own session
    insert(user=4,agent=1,event=1) # organizer without a participant role
    insert(agent=3,event=1,ok=False) # another event's agent
    insert(agent=1,ok=False) # another owner's event agent outside its event
    insert(agent=5,ok=False) # disabled
    insert(agent=99,ok=False) # missing agent
    insert(agent=2,event=2,ok=False) # not a member of that event
    insert(agent=2,event=99,ok=False) # missing event
    insert(agent=2,event=1,project=2,ok=False) # project from a different event
    insert(agent=2,project=1,ok=False) # event project without its event
    insert(user=7,agent=2,project=2,ok=False) # private project, not a member
    insert(user=7,agent=2,project=3,ok=False) # public project, not a member
    as_user(1,f"UPDATE public.meetings SET event_id='10000000-0000-4000-8000-000000000002' WHERE id={meeting};",False,sqlstate='42501')

    # Row ownership on UPDATE/DELETE filters rather than erroring.
    for other in (7,3,4):
        as_user(other,f"DO $$ BEGIN UPDATE public.meetings SET name='forged' WHERE id={meeting}; IF FOUND THEN RAISE EXCEPTION 'nonowner update'; END IF; END $$;")
    as_user(7,f"DO $$ BEGIN DELETE FROM public.meetings WHERE id={meeting}; IF FOUND THEN RAISE EXCEPTION 'outsider deleted meeting'; END IF; END $$;")
    sql("UPDATE public.agents SET enabled=false WHERE id='30000000-0000-4000-8000-000000000001';")
    as_user(1,f"UPDATE public.meetings SET name='Legacy rename' WHERE id={meeting};") # rename skips revalidation
    as_user(1,f"UPDATE public.meetings SET agent_id='30000000-0000-4000-8000-000000000005' WHERE id={meeting};",False)
    as_user(1,f"UPDATE public.meetings SET agent_id='30000000-0000-4000-8000-000000000002' WHERE id={meeting};")

    # Service role still writes processing fields, and exactly one claim wins.
    def claim(_):
        return sql(f"SET ROLE service_role; UPDATE public.meetings SET status='processing' WHERE id={meeting} AND status='upcoming' RETURNING id;")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        winners=sum('40000000-0000-4000-8000-000000000001' in value for value in pool.map(claim,range(16)))
    assert winners == 1, winners
    as_user(1,f"UPDATE public.meetings SET status='upcoming' WHERE id={meeting}",False)
    sql(f"SET ROLE service_role; UPDATE public.meetings SET status='completed',summary='Server summary',score=90,category_scores='{{}}'::jsonb,transcript_url='https://example.test/t' WHERE id={meeting};")
    sql("SET ROLE service_role; UPDATE public.meetings SET event_id='10000000-0000-4000-8000-000000000002' WHERE id='40000000-0000-4000-8000-000000000002';") # server reassociation skips the client check

    # The auto-conversation definer function is server/trigger only.
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
    # The real role trigger still creates TODO conversations, including linked agents.
    sql("""UPDATE public.events SET session_caps='{"auto_conversations":{"participant":["30000000-0000-4000-8000-000000000001","30000000-0000-4000-8000-000000000004"]}}'::jsonb
      WHERE event_id='10000000-0000-4000-8000-000000000001';
      UPDATE public.agents SET enabled=true WHERE id='30000000-0000-4000-8000-000000000001';
      SET ROLE service_role;
      INSERT INTO public.user_event_roles(user_id,event_id,role) VALUES
      ('00000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','participant');
      RESET ROLE;
      DO $$ BEGIN
       IF (SELECT count(*) FROM public.meetings WHERE user_id='00000000-0000-4000-8000-000000000007'
           AND event_id='10000000-0000-4000-8000-000000000001' AND status='upcoming'
           AND name IN ('TODO: Event agent','TODO: Shared linked agent')) <> 2 THEN
         RAISE EXCEPTION 'role trigger no longer creates TODO conversations';
       END IF;
      END $$;
      SET ROLE service_role;
      SELECT public.create_auto_conversations_for_event_role('00000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','participant');
      RESET ROLE;
      DO $$ BEGIN
       IF (SELECT count(*) FROM public.meetings WHERE user_id='00000000-0000-4000-8000-000000000007'
           AND event_id='10000000-0000-4000-8000-000000000001') <> 2 THEN RAISE EXCEPTION 'server retry duplicated TODO'; END IF;
      END $$;""")

    as_user(1,"DO $$ BEGIN DELETE FROM public.meetings WHERE id='40000000-0000-4000-8000-000000000003'; IF NOT FOUND THEN RAISE EXCEPTION 'owner delete failed'; END IF; END $$;")
    print('PASS: meeting read/timeline/write-limit/association/CAS checks (reduced fixture)')
    print('No production database touched; caller will dispose the container.')
