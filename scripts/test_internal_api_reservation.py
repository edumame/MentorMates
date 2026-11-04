#!/usr/bin/env python3
"""Test reserve_internal_api_call in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Run from repository root. Applies the real table and reservation migrations.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import time
import uuid

from test_scraper_quota import CONTAINER, docker, sql

MIGRATIONS = Path(__file__).resolve().parents[1] / "supabase/migrations"
TABLES = MIGRATIONS / "20260919_add_internal_invites_and_usage.sql"
RESERVATION = MIGRATIONS / "202611050102_reserve_internal_api_call.sql"
SIGNATURE = "public.reserve_internal_api_call"


def new_key():
    key = str(uuid.uuid4())
    sql(f"INSERT INTO public.agent_api_keys (id) VALUES ('{key}');")
    return key


def new_invite(columns="", values=""):
    invite = str(uuid.uuid4())
    sql(f"INSERT INTO public.internal_invites (id, code{columns}) VALUES ('{invite}', '{invite}'{values});")
    return invite


def reserve(key, invite, limit=5):
    """Return (outcome, usage_id, calls_in_window) from one independent session."""
    row = sql(
        "SET ROLE service_role; SELECT outcome, usage_id, calls_in_window FROM "
        f"{SIGNATURE}('jev', '{key}', '{invite}', {limit}, 60);"
    ).stdout.strip()
    return tuple(row.split("|"))


def scalar(statement):
    return sql(statement).stdout.strip()


def main():
    # Pull separately: a cold CI runner may need considerably longer than a SQL call.
    docker("pull", "postgres:16.15", timeout=600)
    try:
        docker("run", "--detach", "--name", CONTAINER, "--network", "none",
               "--tmpfs", "/var/lib/postgresql/data:rw", "--env",
               "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:16.15")
        for _ in range(60):
            # TCP readiness only succeeds once the final server is running.
            if docker("exec", CONTAINER, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", check=False).returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise RuntimeError("Disposable PostgreSQL failed to start")
        sql("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;")
        sql("CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);")
        sql("CREATE TABLE public.agent_api_keys (id uuid PRIMARY KEY);")
        sql(TABLES.read_text())
        sql("GRANT SELECT ON public.internal_api_usage TO service_role;")
        sql(RESERVATION.read_text())
        sql(RESERVATION.read_text())  # Must be safe to apply twice.

        key, invite = new_key(), new_invite()
        for role in ("anon", "authenticated"):
            result = sql(f"SET ROLE {role}; SELECT * FROM {SIGNATURE}('jev', '{key}', '{invite}', 5, 60);", check=False)
            assert result.returncode != 0 and "permission denied" in result.stderr, (role, result.stderr)
        for bad_args in (f"'jev', NULL, '{invite}', 5, 60", f"'jev', '{key}', NULL, 5, 60",
                         f"'jev', '{key}', '{invite}', NULL, 60", f"'jev', '{key}', '{invite}', 5, 0"):
            result = sql(f"SET ROLE service_role; SELECT * FROM {SIGNATURE}({bad_args});", check=False)
            assert result.returncode != 0 and "required" in result.stderr, (bad_args, result.stderr)

        # Thirty independent database sessions race for the same five slots.
        with ThreadPoolExecutor(max_workers=30) as pool:
            results = list(pool.map(lambda _: reserve(key, invite), range(30)))
        reserved = [result for result in results if result[0] == "reserved"]
        assert len(reserved) == 5, results
        assert sorted(result[2] for result in reserved) == ["0", "1", "2", "3", "4"], results
        assert all(result[0] == "rate_limited" and result[1] == "" for result in results if result not in reserved), results
        assert scalar(f"SELECT count(*) FROM public.internal_api_usage WHERE key_id='{key}';") == "5"
        assert scalar(f"SELECT uses FROM public.internal_invites WHERE id='{invite}';") == "5", "Denied calls must not use the invite"

        # A reserved row is completed by the route with the service role.
        usage_id = reserved[0][1]
        sql(f"SET ROLE service_role; UPDATE public.internal_api_usage SET status = 200, latency_ms = 9 WHERE id = {usage_id};")
        assert scalar(f"SELECT status FROM public.internal_api_usage WHERE id = {usage_id};") == "200"

        # Keys have independent limits, and old rows leave the sliding window.
        assert reserve(new_key(), invite)[0] == "reserved"
        sql(f"UPDATE public.internal_api_usage SET created_at = now() - interval '61 seconds' WHERE key_id='{key}';")
        assert reserve(key, invite)[:1] == ("reserved",)
        assert reserve(key, invite)[2] == "1"

        # max_uses holds across keys racing on one invite, without using up their slots.
        capped = new_invite(", max_uses", ", 3")
        keys = [new_key() for _ in range(10)]
        with ThreadPoolExecutor(max_workers=10) as pool:
            outcomes = [result[0] for result in pool.map(lambda k: reserve(k, capped), keys)]
        assert outcomes.count("reserved") == 3 and outcomes.count("invite_unavailable") == 7, outcomes
        assert scalar(f"SELECT uses FROM public.internal_invites WHERE id='{capped}';") == "3"
        assert scalar(f"SELECT count(*) FROM public.internal_api_usage WHERE invite_id='{capped}';") == "3"

        # An invite revoked, expired or for another service after the route read it.
        for columns, values in ((", revoked_at", ", now()"), (", expires_at", ", now() - interval '1 second'"),
                                (", service", ", 'other'")):
            assert reserve(new_key(), new_invite(columns, values))[0] == "invite_unavailable", columns
        print("PASS: atomic reservation, concurrency, independent keys, window expiry, invite caps, and denied roles")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
