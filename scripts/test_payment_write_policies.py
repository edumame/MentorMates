#!/usr/bin/env python3
"""Test that user_event_payments is server-write-only in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Run from repository root.
"""
from pathlib import Path
import subprocess
import time
import uuid

MIGRATIONS = Path(__file__).resolve().parents[1] / "supabase/migrations"
CREATE_TABLE = MIGRATIONS / "20250620_create_user_event_payments.sql"
INCOMPLETE_RLS = MIGRATIONS / "20251028_user_event_payments_rls.sql"
FIX = MIGRATIONS / "202611050028_user_event_payments_server_write_only.sql"
CONTAINER = "mentormates-payment-rls-test-" + uuid.uuid4().hex[:12]
USER = str(uuid.uuid4())
EVENT = str(uuid.uuid4())

# The minimum Supabase surface the two payment migrations depend on.
PREREQUISITES = """
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
CREATE TABLE public.user_profiles (uid uuid PRIMARY KEY);
CREATE TABLE public.events (event_id uuid PRIMARY KEY);
CREATE TABLE public.user_event_roles (user_id uuid, event_id uuid, role text);
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS
  $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
"""
# Supabase's default privileges give the API roles ALL on public tables.
GRANTS = "GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;"


def docker(*args, input=None, check=True, timeout=90):
    result = subprocess.run(["docker", *args], input=input, text=True,
                            capture_output=True, check=False, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f"Disposable Docker command failed: {result.stderr or result.stdout}")
    return result


def sql(statement, check=True):
    return docker("exec", "-i", CONTAINER, "psql", "-X", "-h", "127.0.0.1", "-U", "postgres",
                  "-v", "ON_ERROR_STOP=1", "-Atq", input=statement, check=check)


def as_user(statement, check=True):
    return sql(f"SET request.jwt.sub = '{USER}'; SET ROLE authenticated; {statement}", check=check)


def insert_payment(status):
    return (f"INSERT INTO public.user_event_payments (user_id, event_id, stripe_customer_id, payment_status) "
            f"VALUES ('{USER}', '{EVENT}', 'cus_forged', '{status}');")


def main():
    # Pull separately: a cold CI runner may need considerably longer than a SQL call.
    docker("pull", "postgres:16.15", timeout=600)
    try:
        docker("run", "--detach", "--name", CONTAINER, "--network", "none",
               "--tmpfs", "/var/lib/postgresql/data:rw", "--env",
               "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:16.15")
        for _ in range(60):
            # The image init server accepts Unix sockets before restarting. TCP
            # readiness only succeeds once the final server is running.
            if docker("exec", CONTAINER, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", check=False).returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise RuntimeError("Disposable PostgreSQL failed to start")
        sql(PREREQUISITES)
        sql(CREATE_TABLE.read_text())
        sql(INCOMPLETE_RLS.read_text())
        sql(GRANTS)
        sql(f"INSERT INTO public.user_profiles VALUES ('{USER}'); INSERT INTO public.events VALUES ('{EVENT}');")

        # Before the fix the forgery works, which shows this test can detect the bug.
        as_user(insert_payment("paid"))
        sql("DELETE FROM public.user_event_payments;")
        sql(f"INSERT INTO public.user_event_payments (user_id, event_id, stripe_customer_id) "
            f"VALUES ('{USER}', '{EVENT}', 'cus_real');")
        assert as_user("UPDATE public.user_event_payments SET payment_status = 'paid' RETURNING payment_status;"
                       ).stdout.split()[-1] == "paid"
        sql("UPDATE public.user_event_payments SET payment_status = 'processing';")

        # A write policy under an unknown name stands in for production schema drift.
        sql('CREATE POLICY "Drifted write policy" ON public.user_event_payments '
            "FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);")

        sql(FIX.read_text())
        sql(FIX.read_text())

        writes = sql("SELECT polname FROM pg_policy WHERE polrelid = 'public.user_event_payments'::regclass "
                     "AND polcmd IN ('a', 'w');").stdout.split("\n")
        assert not any("own payments" in name for name in writes), writes

        for statement in (
            "UPDATE public.user_event_payments SET payment_status = 'paid';",
            "UPDATE public.user_event_payments SET amount_paid = 0;",
            "DELETE FROM public.user_event_payments;",
            insert_payment("paid"),
        ):
            result = as_user(statement, check=False)
            assert result.returncode != 0 and "permission denied" in result.stderr, (statement, result.stderr)
            anon = sql(f"SET ROLE anon; {statement}", check=False)
            assert anon.returncode != 0 and "permission denied" in anon.stderr, (statement, anon.stderr)

        assert as_user("SELECT payment_status FROM public.user_event_payments;").stdout.split()[-1] == "processing"

        # The checkout upsert and the webhook update must keep working.
        sql(f"SET ROLE service_role; INSERT INTO public.user_event_payments "
            f"(user_id, event_id, stripe_customer_id, payment_status) VALUES ('{USER}', '{EVENT}', 'cus_real', 'processing') "
            f"ON CONFLICT (user_id, event_id) DO UPDATE SET stripe_session_id = 'cs_1';")
        sql("SET ROLE service_role; UPDATE public.user_event_payments SET payment_status = 'paid';")
        assert as_user("SELECT payment_status FROM public.user_event_payments;").stdout.split()[-1] == "paid"

        # The migration must be a no-op where the table does not exist.
        sql("DROP TABLE public.user_event_payments;")
        sql(FIX.read_text())
        print("PASS: forgery reproduced before the fix; browser roles denied, reads and service writes kept after it")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
