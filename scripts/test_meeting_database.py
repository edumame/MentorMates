#!/usr/bin/env python3
"""Run real meeting-boundary assertions in a fresh, disposable offline PostgreSQL16.

No existing container, database URL, or repository override is accepted.
"""
import importlib.util
from pathlib import Path
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
IMAGE = "postgres:16.15"


def docker(*args, check=True, timeout=90):
    result = subprocess.run(["docker", *args], text=True, capture_output=True, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return result


def main():
    if len(sys.argv) != 1:
        raise SystemExit("No arguments supported: this command only creates its own disposable database.")
    name = "mentormates-security-tests-meetings-" + uuid.uuid4().hex[:12]
    docker("pull", IMAGE, timeout=600)
    try:
        docker("run", "--detach", "--name", name, "--network", "none",
               "--tmpfs", "/var/lib/postgresql/data:rw", "--env",
               "POSTGRES_HOST_AUTH_METHOD=trust", IMAGE)
        for _ in range(60):
            # The image initialization server accepts only Unix sockets. Wait
            # for the final TCP server, then probe the same connection as tests.
            ready = docker("exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", check=False)
            if ready.returncode == 0:
                probe = docker("exec", name, "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", "postgres", "-Atc", "SELECT 1", check=False)
                if probe.returncode == 0:
                    break
            time.sleep(0.5)
        else:
            raise RuntimeError("PostgreSQL startup timed out: " + docker("logs", name, check=False).stderr)
        path = ROOT / "scripts/tests/meeting_database/assertions.py"
        spec = importlib.util.spec_from_file_location("meeting_database_assertions", path)
        if spec is None or spec.loader is None:
            raise RuntimeError("Cannot load meeting database assertions")
        sys.dont_write_bytecode = True
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.run_assertions(name, ROOT)
    finally:
        cleanup = docker("rm", "--force", name, check=False)
        if cleanup.returncode == 0:
            print("Disposed isolated tmpfs PostgreSQL container.")
        else:
            raise RuntimeError("Container cleanup did not complete: " + cleanup.stderr)


if __name__ == "__main__":
    main()
