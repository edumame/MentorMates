#!/usr/bin/env python3
"""Test that the coupons_with_codes migration closes the promo code leak.

Runs in a disposable PostgreSQL container. No database URL or production
connection is accepted. Requires Docker and Python3.
"""
from pathlib import Path
import re
import subprocess
import time
import uuid

MIGRATIONS = Path(__file__).resolve().parents[1] / "supabase/migrations"
VIEW_SOURCE = MIGRATIONS / "20250920_refactor_promo_codes_table.sql"
MIGRATION = MIGRATIONS / "202611050036_drop_coupons_with_codes_view.sql"
CONTAINER = "mentormates-promo-view-test-" + uuid.uuid4().hex[:12]

# Only the columns the view reads. RLS is on with no policy for anon, as in production.
SCHEMA = """
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
CREATE TABLE public.coupons (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
CREATE TABLE public.promo_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
    code text NOT NULL UNIQUE,
    usage_count integer DEFAULT 0 NOT NULL,
    max_uses integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
WITH coupon AS (INSERT INTO public.coupons (name) VALUES ('Free entry') RETURNING id)
INSERT INTO public.promo_codes (coupon_id, code) SELECT id, 'SECRET100' FROM coupon;
"""


def docker(*args, input=None, check=True, timeout=90):
    result = subprocess.run(["docker", *args], input=input, text=True,
                            capture_output=True, check=False, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f"Disposable Docker command failed: {result.stderr or result.stdout}")
    return result


def sql(statement, check=True):
    return docker("exec", "-i", CONTAINER, "psql", "-X", "-h", "127.0.0.1", "-U", "postgres",
                  "-v", "ON_ERROR_STOP=1", "-Atq", input=statement, check=check)


def view_definition():
    match = re.search(r'CREATE VIEW "public"\."coupons_with_codes".*?;', VIEW_SOURCE.read_text(), re.S)
    assert match, "The original view definition was not found"
    return match.group(0)


def main():
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
        sql(view_definition())
        for role in ("anon", "authenticated"):
            # Proves this setup reproduces the leak, so the checks below mean something.
            leaked = sql(f"SET ROLE {role}; SELECT promo_codes FROM public.coupons_with_codes;").stdout
            assert "SECRET100" in leaked, (role, leaked)

        migration = MIGRATION.read_text()
        sql(migration)
        sql(migration)  # Must also be a no-op where the view is already gone.

        assert sql("SELECT to_regclass('public.coupons_with_codes') IS NULL;").stdout.strip() == "t"
        for role in ("anon", "authenticated"):
            result = sql(f"SET ROLE {role}; SELECT * FROM public.coupons_with_codes;", check=False)
            assert result.returncode != 0 and "does not exist" in result.stderr, (role, result.stderr)
            direct = sql(f"SET ROLE {role}; SELECT count(*) FROM public.promo_codes;").stdout.strip()
            assert direct == "0", (role, direct)
        assert sql("SELECT count(*) FROM public.promo_codes;").stdout.strip() == "1", "Promo codes must survive"
        print("PASS: view leak reproduced, then closed for anon and authenticated; data kept")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
