#!/usr/bin/env python3
"""Test project invitations, vote/booking permissions and races in disposable Postgres only."""
from concurrent.futures import ThreadPoolExecutor
from rls_test_harness import Checks, Database

A='00000000-0000-0000-0000-000000000001'
B='00000000-0000-0000-0000-000000000002'
E='00000000-0000-0000-0000-000000000003'
S='00000000-0000-0000-0000-000000000004'
P=[f'10000000-0000-0000-0000-{i:012d}' for i in range(1,5)]
SCHEMA=f"""
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public,auth TO service_role;
CREATE TABLE user_profiles(uid uuid PRIMARY KEY);
CREATE TABLE events(event_id uuid PRIMARY KEY,owner_id uuid);
CREATE TABLE user_event_roles(user_id uuid,event_id uuid,role text);
CREATE TABLE projects(id uuid PRIMARY KEY,event_id uuid,lead_email text,teammates text[],project_name text,lead_name text,cover_image_url text);
CREATE FUNCTION is_admin_user(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION is_event_organizer_or_owner(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM events WHERE event_id=$1 AND owner_id=$2) $$;
INSERT INTO auth.users VALUES ('{A}','a@example.invalid'),('{B}','b@example.invalid');
INSERT INTO user_profiles VALUES ('{A}'),('{B}');
INSERT INTO events VALUES ('{E}','{A}');
INSERT INTO user_event_roles VALUES ('{A}','{E}','participant'),('{B}','{E}','participant');
INSERT INTO projects(id,event_id,lead_email,teammates) VALUES {','.join(f"('{p}','{E}','a@example.invalid',ARRAY[]::text[])" for p in P)};
"""

def main():
    checks=Checks()
    with Database('atomic-flows') as db:
        db.sql(SCHEMA)
        db.migrate('20251224_create_project_votes.sql','20260413_mentor_booking.sql')
        db.sql('GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;')
        db.migrate('202611060201_atomic_project_join.sql','202611060202_atomic_votes.sql','202611060203_atomic_mentor_booking.sql')
        ok,_=db.attempt('authenticated',A,f"INSERT INTO project_votes(project_id,event_id,user_id) VALUES ('{P[0]}','{E}','{A}')")
        checks.expect('direct vote insert denied',ok,False)
        for p in P[:2]:
            ok,_=db.attempt('authenticated',A,f"SELECT cast_project_vote('{E}','{p}')")
            checks.expect('eligible RPC vote succeeds',ok,True)
        with ThreadPoolExecutor(2) as pool:
            results=list(pool.map(lambda p:db.attempt('authenticated',A,f"SELECT cast_project_vote('{E}','{p}'); SELECT pg_sleep(0.2)"),P[2:]))
        checks.expect('concurrent final vote allows exactly one',sum(ok for ok,_ in results),1)
        checks.expect('three votes maximum',db.sql(f"SELECT count(*) FROM project_votes WHERE user_id='{A}'"),'3')
        db.sql(f"UPDATE user_event_roles SET role='judge' WHERE user_id='{B}'")
        ok,_=db.attempt('authenticated',B,f"SELECT cast_project_vote('{E}','{P[0]}')")
        checks.expect('judge vote denied',ok,False)
        db.sql(f"INSERT INTO auth.users SELECT md5('fixture-voter-'||i)::uuid,'voter-'||i||'@example.invalid' FROM generate_series(1,1201) i; INSERT INTO project_votes(project_id,user_id,event_id) SELECT '{P[0]}',id,'{E}' FROM auth.users WHERE email LIKE 'voter-%'")
        ok,value=db.attempt('authenticated',A,f"SELECT project_vote_summary('{E}')->'voteCounts'->>'{P[0]}'")
        checks.expect('aggregate counts beyond API row cap',value,'1202')
        ok,value=db.attempt('authenticated',A,f"SELECT jsonb_array_length(project_vote_summary('{E}')->'userVotes')")
        checks.expect('own vote summary retains three votes',value,'3')
        ok,value=db.attempt('authenticated',A,f"SELECT project_vote_results('{E}')->>'totalVotes'")
        checks.expect('organizer aggregate includes every vote',value,'1204')

        db.sql(f"UPDATE user_event_roles SET role='participant' WHERE user_id='{B}'")
        # Slot owner is unrelated to either booking participant.
        db.sql(f"INSERT INTO user_profiles VALUES ('{S}'); INSERT INTO mentor_availability(id,event_id,mentor_id,start_time,end_time,max_bookings) VALUES ('{S}','{E}','{S}',now(),now()+interval '1 hour',1)")
        with ThreadPoolExecutor(2) as pool:
            results=list(pool.map(lambda actor:db.attempt('authenticated',actor,f"SELECT book_mentor_slot('{E}','{S}'); SELECT pg_sleep(0.2)"),[A,B]))
        checks.expect('last slot admits exactly one concurrent participant',sum(ok for ok,_ in results),1)
        ok,_=db.attempt('authenticated',B,f"INSERT INTO mentor_bookings(availability_id,participant_id) VALUES ('{S}','{B}')")
        checks.expect('direct booking insert denied',ok,False)
        winner=db.sql("SELECT participant_id FROM mentor_bookings LIMIT 1")
        ok,_=db.attempt('authenticated',winner,f"DELETE FROM mentor_bookings WHERE availability_id='{S}'")
        checks.expect('winner can cancel own booking',ok,True)
        checks.expect('cancellation removes reservation',db.sql('SELECT count(*) FROM mentor_bookings'),'0')
        db.sql(f"DELETE FROM mentor_bookings; UPDATE mentor_availability SET start_time=now()-interval '2 hours',end_time=now()-interval '1 hour'")
        ok,_=db.attempt('authenticated',A,f"SELECT book_mentor_slot('{E}','{S}')")
        checks.expect('ended slot rejected',ok,False)
        ok,_=db.attempt('authenticated',B,f"SELECT accept_project_invitation('{P[0]}','{B}','a@example.invalid')")
        checks.expect('untrusted direct invitation RPC denied',ok,False)
        with ThreadPoolExecutor(2) as pool:
            results=list(pool.map(lambda _:db.attempt('service_role',None,f"SELECT accept_project_invitation('{P[0]}','{B}','a@example.invalid'); SELECT pg_sleep(0.2)"),range(2)))
        checks.expect('concurrent repeated service invitation accepted',sum(ok for ok,_ in results),2)
        db.sql(f"UPDATE projects SET lead_email=NULL WHERE id='{P[1]}'")
        ok,_=db.attempt('service_role',None,f"SELECT accept_project_invitation('{P[1]}','{B}','outsider@example.invalid')")
        checks.expect('null lead does not bypass inviter membership',ok,False)
        db.sql(f"UPDATE projects SET lead_email='a@example.invalid' WHERE id='{P[1]}'")
        checks.expect('repeat invitation idempotent',db.sql(f"SELECT cardinality(teammates) FROM projects WHERE id='{P[0]}'"),'1')
        db.sql(f"DELETE FROM user_event_roles WHERE user_id='{B}'")
        ok,_=db.attempt('service_role',None,f"SELECT accept_project_invitation('{P[1]}','{B}','a@example.invalid')")
        checks.expect('event outsider denied by invitation RPC',ok,False)
    checks.finish()

if __name__=='__main__': main()
