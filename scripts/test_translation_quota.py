#!/usr/bin/env python3
"""Test the translation quota migration in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Mirrors scripts/test_scraper_quota.py.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import time
import uuid

MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/202610270003_translation_request_quota.sql"
CONTAINER = "mentormates-translation-quota-test-" + uuid.uuid4().hex[:12]
MAX_REQUESTS = 30
MAX_CHARS = 100000


def docker(*args, input=None, check=True, timeout=90):
    result = subprocess.run(["docker", *args], input=input, text=True,
                            capture_output=True, check=False, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f"Disposable Docker command failed: {result.stderr or result.stdout}")
    return result


def sql(statement, check=True):
    return docker("exec", "-i", CONTAINER, "psql", "-X", "-h", "127.0.0.1", "-U", "postgres",
                  "-v", "ON_ERROR_STOP=1", "-Atq", input=statement, check=check)


def reserve(user, chars=1):
    return sql(f"SET ROLE service_role; SELECT * FROM public.reserve_translation_request('{user}', {chars});").stdout.strip()


def counts(user):
    return sql(f"SELECT request_count, char_count FROM public.translation_request_quota WHERE user_id='{user}';").stdout.strip()


def expire_window(user):
    sql(f"UPDATE public.translation_request_quota SET window_start = date_trunc('hour', now()) - interval '1 hour' WHERE user_id='{user}';")


def main():
    migration = MIGRATION.read_text()
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
        sql("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;")
        sql(migration)
        first = str(uuid.uuid4())

        # Clients cannot touch the table or the RPC.
        for role in ("anon", "authenticated"):
            for statement in (
                f"SELECT * FROM public.reserve_translation_request('{first}', 1);",
                "SELECT * FROM public.translation_request_quota;",
                f"INSERT INTO public.translation_request_quota VALUES ('{first}', now(), 1, 1);",
                "UPDATE public.translation_request_quota SET request_count = 1;",
                "DELETE FROM public.translation_request_quota;",
            ):
                result = sql(f"SET ROLE {role}; {statement}", check=False)
                assert result.returncode != 0 and "permission denied" in result.stderr, (role, statement, result.stderr)

        # Input validation.
        null_user = sql("SET ROLE service_role; SELECT * FROM public.reserve_translation_request(NULL, 1);", check=False)
        assert null_user.returncode != 0 and "verified user ID" in null_user.stderr
        for bad in ("NULL", "0", "-1", "10001"):
            result = sql(f"SET ROLE service_role; SELECT * FROM public.reserve_translation_request('{first}', {bad});", check=False)
            assert result.returncode != 0 and "Character count" in result.stderr, (bad, result.stderr)

        # Concurrent sessions race for the request slots.
        with ThreadPoolExecutor(max_workers=40) as pool:
            results = list(pool.map(reserve, [first] * 40))
        assert results.count("t|0") == MAX_REQUESTS, results
        denied = [r for r in results if r.startswith("f|")]
        assert len(denied) == 40 - MAX_REQUESTS, results
        assert all(1 <= int(r.split("|")[1]) <= 3600 for r in denied), denied
        assert counts(first) == f"{MAX_REQUESTS}|{MAX_REQUESTS}", counts(first)
        assert reserve(str(uuid.uuid4())) == "t|0", "Users must have independent quotas"

        # Rollover resets both counters.
        expire_window(first)
        assert reserve(first, 10000) == "t|0"
        assert counts(first) == "1|10000", counts(first)

        # Character budget: exactly MAX_CHARS is allowed, one more is denied.
        assert [reserve(first, 10000) for _ in range(9)] == ["t|0"] * 9
        assert counts(first) == f"10|{MAX_CHARS}", counts(first)
        assert reserve(first, 1).startswith("f|"), "Character budget must be enforced"
        assert counts(first) == f"10|{MAX_CHARS}", "Denied reservations must not change counters"

        # Partial budget: a large request is denied while a smaller one still fits.
        expire_window(first)
        assert reserve(first, 9500) == "t|0"
        sql(f"UPDATE public.translation_request_quota SET char_count = {MAX_CHARS - 500} WHERE user_id='{first}';")
        assert reserve(first, 501).startswith("f|")
        assert reserve(first, 500) == "t|0"

        # A statement whose computed window trails the stored window keeps the stored one.
        sql(f"UPDATE public.translation_request_quota SET window_start = date_trunc('hour', now()) + interval '1 hour', request_count = 1, char_count = 1 WHERE user_id='{first}';")
        saved_window = sql(f"SELECT window_start FROM public.translation_request_quota WHERE user_id='{first}';").stdout.strip()
        assert reserve(first, 5) == "t|0"
        assert sql(f"SELECT window_start FROM public.translation_request_quota WHERE user_id='{first}';").stdout.strip() == saved_window
        assert counts(first) == "2|6", counts(first)
        sql(f"UPDATE public.translation_request_quota SET request_count = {MAX_REQUESTS} WHERE user_id='{first}';")
        assert reserve(first) == "f|3600", "Retry must use the stored window, not the stale request window"
        print("PASS: atomic quota, char budget, concurrency, independent users, rollover, Retry-After, validation, and denied roles")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
