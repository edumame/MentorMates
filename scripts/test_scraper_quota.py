#!/usr/bin/env python3
"""Test the actual additive quota migration in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Run from repository root after placing the migration at MIGRATION below.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import time
import uuid

MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/202610200001_scraper_request_quota.sql"
CONTAINER = "mentormates-quota-test-" + uuid.uuid4().hex[:12]


def docker(*args, input=None, check=True, timeout=90):
    result = subprocess.run(["docker", *args], input=input, text=True,
                            capture_output=True, check=False, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f"Disposable Docker command failed: {result.stderr or result.stdout}")
    return result


def sql(statement, check=True):
    return docker("exec", "-i", CONTAINER, "psql", "-X", "-h", "127.0.0.1", "-U", "postgres",
                  "-v", "ON_ERROR_STOP=1", "-Atq", input=statement, check=check)


def reserve(user):
    return sql(f"SET ROLE service_role; SELECT * FROM public.reserve_scraper_request('{user}');").stdout.strip()


def main():
    migration = MIGRATION.read_text()
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
        sql("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;")
        sql(migration)
        first = str(uuid.uuid4())
        for role in ("anon", "authenticated"):
            for statement in (
                f"SELECT * FROM public.reserve_scraper_request('{first}');",
                "SELECT * FROM public.scraper_request_quota;",
                f"INSERT INTO public.scraper_request_quota VALUES ('{first}', now(), 1);",
                "UPDATE public.scraper_request_quota SET request_count = 1;",
                "DELETE FROM public.scraper_request_quota;",
            ):
                result = sql(f"SET ROLE {role}; {statement}", check=False)
                assert result.returncode != 0 and "permission denied" in result.stderr, (role, statement, result.stderr)
        null_result = sql("SET ROLE service_role; SELECT * FROM public.reserve_scraper_request(NULL);", check=False)
        assert null_result.returncode != 0 and "verified user ID" in null_result.stderr
        # Thirty independent database sessions race for the same five slots.
        with ThreadPoolExecutor(max_workers=30) as pool:
            results = list(pool.map(reserve, [first] * 30))
        assert results.count("t|0") == 5, results
        denied = [result for result in results if result.startswith("f|")]
        assert len(denied) == 25, results
        assert all(1 <= int(result.split("|")[1]) <= 3600 for result in denied), denied
        assert sql(f"SELECT request_count FROM public.scraper_request_quota WHERE user_id='{first}';").stdout.strip() == "5"
        assert reserve(str(uuid.uuid4())) == "t|0", "Users must have independent quotas"
        # Seed an expired window rather than sleeping or altering the DB clock.
        for _ in range(2):
            sql(f"UPDATE public.scraper_request_quota SET window_start = date_trunc('hour', now()) - interval '1 hour' WHERE user_id='{first}';")
            assert [reserve(first) for _ in range(5)] == ["t|0"] * 5
            assert reserve(first).startswith("f|")
        # Simulate a statement whose computed window trails the stored window.
        sql(f"UPDATE public.scraper_request_quota SET window_start = date_trunc('hour', now()) + interval '1 hour', request_count = 1 WHERE user_id='{first}';")
        saved_window = sql(f"SELECT window_start FROM public.scraper_request_quota WHERE user_id='{first}';").stdout.strip()
        assert reserve(first) == "t|0"
        assert sql(f"SELECT window_start FROM public.scraper_request_quota WHERE user_id='{first}';").stdout.strip() == saved_window
        assert sql(f"SELECT request_count FROM public.scraper_request_quota WHERE user_id='{first}';").stdout.strip() == "2"
        sql(f"UPDATE public.scraper_request_quota SET request_count = 5 WHERE user_id='{first}';")
        assert reserve(first) == "f|3600", "Retry must use the stored window, not the stale request window"
        print("PASS: atomic quota, concurrency, independent users, rollover, Retry-After, and denied roles")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
