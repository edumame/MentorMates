"""Disposable PostgreSQL harness for testing RLS migrations.

No database URL or production connection is accepted. Requires Docker.
"""
from pathlib import Path
import subprocess
import time
import uuid

MIGRATIONS = Path(__file__).resolve().parents[1] / "supabase/migrations"

# The small part of Supabase that policies rely on.
BASE_SCHEMA = """
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.uid', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
"""


class Database:
    def __init__(self, name):
        self.container = f"mentormates-{name}-{uuid.uuid4().hex[:12]}"

    def __enter__(self):
        subprocess.run(
            ["docker", "run", "--detach", "--rm", "--name", self.container, "--network", "none",
             "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:16.15"],
            check=True, capture_output=True, text=True, timeout=120,
        )
        for _ in range(60):
            ready = subprocess.run(
                ["docker", "exec", self.container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
                capture_output=True, text=True,
            )
            if ready.returncode == 0:
                self.sql(BASE_SCHEMA)
                return self
            time.sleep(1)
        raise RuntimeError("Disposable PostgreSQL did not start")

    def __exit__(self, *_):
        subprocess.run(["docker", "rm", "-f", self.container], capture_output=True, text=True)

    def _psql(self, statement):
        return subprocess.run(
            ["docker", "exec", "-i", self.container, "psql", "-X", "-h", "127.0.0.1",
             "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"],
            input=statement, capture_output=True, text=True, timeout=60,
        )

    def sql(self, statement):
        result = self._psql(statement)
        if result.returncode:
            raise RuntimeError(result.stderr or result.stdout)
        return result.stdout.strip()

    def migrate(self, *filenames):
        for filename in filenames:
            self.sql((MIGRATIONS / filename).read_text())

    def attempt(self, role, uid, statement):
        """Run a statement as an API role. Returns (succeeded, output)."""
        result = self._psql(
            "BEGIN;\n"
            f"SET LOCAL request.jwt.uid = '{uid or ''}';\n"
            f"SET LOCAL ROLE {role};\n"
            f"{statement};\n"
            "COMMIT;\n"
        )
        return result.returncode == 0, (result.stdout + result.stderr).strip()


class Checks:
    def __init__(self):
        self.failures = 0

    def expect(self, label, actual, expected):
        passed = actual == expected
        self.failures += 0 if passed else 1
        print(f"{'PASS' if passed else 'FAIL'}: {label}" + ("" if passed else f" (got {actual!r})"))

    def finish(self):
        if self.failures:
            raise SystemExit(f"{self.failures} check(s) failed")
        print("All checks passed")
