"""Disposable PostgreSQL paid-ticket claim regression; no external DB accepted."""
from concurrent.futures import ThreadPoolExecutor
from rls_test_harness import Database, Checks
from test_payment_fulfillment import SCHEMA, U, E, T
V='00000000-0000-0000-0000-000000000005'
W='00000000-0000-0000-0000-000000000006'
def main():
    checks=Checks()
    with Database('ticket-claim') as db:
        db.sql("CREATE TYPE event_role AS ENUM ('participant','organizer');"+SCHEMA.replace('role text','role event_role'))
        db.sql('''
          GRANT USAGE ON SCHEMA auth TO service_role;
          CREATE TABLE events(event_id uuid PRIMARY KEY,owner_id uuid,participant_capacity integer,approval_status text,featured boolean);
          CREATE TABLE role_passwords(event_id uuid,role text,password_hash text);
          CREATE FUNCTION is_admin_user(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
          CREATE FUNCTION is_event_organizer(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
          ALTER TABLE user_event_roles ADD COLUMN id uuid DEFAULT gen_random_uuid();
          ALTER TABLE event_tickets ADD COLUMN assigned_to_email text, ADD COLUMN updated_at timestamptz;
        ''')
        db.sql(f"INSERT INTO auth.users VALUES ('{U}','purchaser@example.invalid'),('{V}','Invitee@Example.invalid'),('{W}','another@example.invalid'); INSERT INTO events VALUES ('{E}','{U}',1,'approved',false); INSERT INTO pricing_tiers VALUES ('{T}','{E}',4,true)")
        db.migrate('20250818_enforce_participant_capacity_trigger.sql','202611060101_harden_admission_permissions.sql','202611060301_checkout_attempts.sql')
        db.sql(f"SELECT register_event_checkout('{U}','{E}','{T}','cus_fixture','cs_claim'); SELECT apply_event_checkout('cs_claim','pi_claim','paid',100,'usd')")
        db.sql('GRANT SELECT,INSERT,UPDATE,DELETE ON event_tickets TO authenticated')
        db.migrate('20251104_event_tickets_rls.sql')
        baseline=db.sql('SELECT id FROM event_tickets WHERE assigned_to_user_id IS NULL ORDER BY id LIMIT 1')
        ok,_=db.attempt('authenticated',U,f"UPDATE event_tickets SET assigned_to_user_id='{W}' WHERE id='{baseline}'")
        checks.expect('baseline broad ticket assignment attack reproduced',ok,True)
        db.sql(f"UPDATE event_tickets SET assigned_to_user_id=NULL WHERE id='{baseline}'")
        db.migrate('202611060501_atomic_ticket_claim.sql')
        for column,value in [('assigned_to_user_id',f"'{W}'"),('checkout_session_id','NULL'),('payment_id','gen_random_uuid()'),('event_id','gen_random_uuid()')]:
            ok,_=db.attempt('authenticated',U,f"UPDATE event_tickets SET {column}={value} WHERE id='{baseline}'")
            checks.expect('client cannot alter ticket '+column,ok,False)
        ticket=db.sql('SELECT id FROM event_tickets WHERE assigned_to_user_id IS NULL ORDER BY id LIMIT 1')
        ok,_=db.attempt('authenticated',U,f"UPDATE event_tickets SET assigned_to_email='invitee@example.invalid',ticket_status='assigned',assigned_at=now(),updated_at=now() WHERE id='{ticket}'")
        checks.expect('purchaser can invite using unclaimed ticket',ok,True)
        ok,_=db.attempt('service_role',None,f"SELECT claim_event_ticket('{ticket}','{W}')")
        checks.expect('wrong email cannot claim',ok,False)
        with ThreadPoolExecutor(max_workers=2) as pool:
            outputs=list(pool.map(lambda _:db.attempt('service_role',None,f"SELECT claim_event_ticket('{ticket}','{V}')"),range(2)))
        checks.expect('same-user repeated claim succeeds idempotently',all(x[0] for x in outputs),True)
        checks.expect('one participant role',db.sql("SELECT count(*) FROM user_event_roles WHERE role='participant'"),'1')
        checks.expect('ticket assigned to normalized email identity',db.sql(f"SELECT assigned_to_user_id FROM event_tickets WHERE id='{ticket}'"),V)
        ok,_=db.attempt('authenticated',U,f"UPDATE event_tickets SET assigned_to_email='another@example.invalid' WHERE id='{ticket}'")
        checks.expect('claimed ticket cannot be reassigned to mint another role',ok,False)
        ticket2=db.sql('SELECT id FROM event_tickets WHERE assigned_to_user_id IS NULL ORDER BY id LIMIT 1')
        db.sql(f"UPDATE event_tickets SET assigned_to_email='another@example.invalid' WHERE id='{ticket2}'")
        ok,_=db.attempt('service_role',None,f"SELECT claim_event_ticket('{ticket2}','{W}')")
        checks.expect('capacity failure rejects claim',ok,False)
        checks.expect('capacity failure rolls back ticket assignment',db.sql(f"SELECT assigned_to_user_id IS NULL FROM event_tickets WHERE id='{ticket2}'"),'t')
        db.sql(f"INSERT INTO user_event_roles(event_id,user_id,role) VALUES ('{E}','{U}','organizer')")
        own=db.sql(f"SELECT id FROM event_tickets WHERE assigned_to_user_id='{U}' LIMIT 1")
        ok,_=db.attempt('service_role',None,f"SELECT claim_event_ticket('{own}','{U}')")
        checks.expect('existing organizer can claim',ok,True)
        checks.expect('existing organizer preserved',db.sql(f"SELECT role FROM user_event_roles WHERE user_id='{U}'"),'organizer')
        ok,_=db.attempt('authenticated',W,f"SELECT claim_event_ticket('{ticket2}','{V}')")
        checks.expect('untrusted user cannot spoof RPC identity',ok,False)
        db.sql("UPDATE payment_checkout_attempts SET status='refunded' WHERE session_id='cs_claim'")
        ok,_=db.attempt('service_role',None,f"SELECT claim_event_ticket('{ticket}','{V}')")
        checks.expect('invalidated payment cannot claim even assigned ticket',ok,False)
    checks.finish()
if __name__=='__main__':main()
