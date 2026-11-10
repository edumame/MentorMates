"""Offline-only PostgreSQL regression. Uses disposable Docker, never a DB URL."""
from concurrent.futures import ThreadPoolExecutor
from rls_test_harness import Database, Checks

U='00000000-0000-0000-0000-000000000001'
E='00000000-0000-0000-0000-000000000002'
T='00000000-0000-0000-0000-000000000003'
SCHEMA='''
CREATE ROLE service_role NOLOGIN;
CREATE TYPE payment_status AS ENUM ('processing','paid','canceled','refunded');
CREATE TABLE user_event_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,event_id uuid,stripe_customer_id text,stripe_session_id text,stripe_payment_intent_id text,pricing_id uuid,payment_status payment_status,amount_paid integer,currency text DEFAULT 'usd',updated_at timestamptz, UNIQUE(user_id,event_id));
CREATE TABLE pricing_tiers(id uuid PRIMARY KEY,event_id uuid,bundle_size integer,is_active boolean);
CREATE TABLE event_tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid,payment_id uuid,purchased_by_user_id uuid,ticket_status text,assigned_to_user_id uuid,assigned_at timestamptz);
CREATE TABLE user_event_roles(event_id uuid,user_id uuid,role text,UNIQUE(user_id,event_id));
'''

def main():
    checks=Checks()
    with Database('payment-regression') as db:
        db.sql(SCHEMA)
        db.sql(f"INSERT INTO pricing_tiers VALUES ('{T}','{E}',2,true)")
        db.migrate('202611060301_checkout_attempts.sql','202611060302_chat_webhook_claims.sql')
        for session in ['cs_one','cs_two']:
            db.sql(f"SELECT register_event_checkout('{U}','{E}','{T}','cus_fixture','{session}')")
        checks.expect('two immutable mappings',db.sql('SELECT count(*) FROM payment_checkout_attempts'),'2')
        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(lambda _:db.sql("SELECT apply_event_checkout('cs_one','pi_one','paid',100,'usd')"),range(2)))
        checks.expect('concurrent replay issues one bundle',db.sql('SELECT count(*) FROM event_tickets'),'2')
        db.sql("SELECT apply_event_checkout('cs_one','pi_one','canceled')")
        checks.expect('late expiry cannot downgrade paid',db.sql('SELECT payment_status FROM user_event_payments'),'paid')
        db.sql("SELECT apply_event_checkout('cs_two','pi_two','paid',100,'usd')")
        checks.expect('both checkout sessions fulfill',db.sql('SELECT count(*) FROM event_tickets'),'4')
        db.sql(f"INSERT INTO user_event_roles VALUES ('{E}','{U}','organizer')")
        db.sql("SELECT apply_event_checkout(NULL,'pi_one','refunded')")
        checks.expect('refund preserves other purchase',db.sql('SELECT payment_status FROM user_event_payments'),'paid')
        checks.expect('refund removes only matching bundle',db.sql('SELECT count(*) FROM event_tickets'),'2')
        db.sql("SELECT apply_event_checkout(NULL,'pi_two','refunded')")
        checks.expect('refund preserves organizer',db.sql('SELECT string_agg(role,\',\') FROM user_event_roles'),'organizer')
        db.sql("SELECT apply_event_checkout('cs_two','pi_two','paid',100,'usd')")
        checks.expect('late completion cannot resurrect refund',db.sql('SELECT count(*) FROM event_tickets'),'0')
        ok,_=db.attempt('authenticated',U,"SELECT apply_event_checkout('cs_two','pi_two','paid',100,'usd')")
        checks.expect('untrusted fulfillment denied',ok,False)
        token='00000000-0000-0000-0000-000000000004'
        checks.expect('chat claim acquired',db.sql(f"SELECT claim_chat_webhook('message','{token}')"),'claimed')
        db.sql(f"SELECT finish_chat_webhook('message','{token}',false)")
        checks.expect('failed chat claim retryable',db.sql(f"SELECT claim_chat_webhook('message','{token}')"),'claimed')
        db.sql(f"SELECT finish_chat_webhook('message','{token}',true)")
        checks.expect('chat completed deduplicated',db.sql(f"SELECT claim_chat_webhook('message','{token}')"),'completed')
    checks.finish()
if __name__=='__main__':main()
