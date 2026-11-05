#!/usr/bin/env python3
"""Test the active-round score trigger in a disposable PostgreSQL container.

No database URL or production connection is accepted. Requires Docker and Python3.
Run from repository root.
"""
from pathlib import Path
import time

from test_scraper_quota import CONTAINER, docker, sql

MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/202611050144_enforce_project_score_active_round.sql"
EVENT = "00000000-0000-0000-0000-000000000001"
SCHEMA = """
CREATE TABLE public.events (event_id uuid PRIMARY KEY, scoring_config jsonb);
CREATE TABLE public.project_scores (
  id serial PRIMARY KEY,
  event_id uuid REFERENCES public.events(event_id) ON DELETE CASCADE,
  round_number int NOT NULL DEFAULT 1,
  comments text
);
GRANT SELECT ON public.events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_scores TO authenticated;
GRANT USAGE ON SEQUENCE public.project_scores_id_seq TO authenticated;
"""


def set_config(config):
    sql(f"UPDATE public.events SET scoring_config = {config} WHERE event_id = '{EVENT}';")


def judge(statement):
    return sql(f"SET ROLE authenticated; {statement}", check=False)


def insert_round(round_number):
    return judge(f"INSERT INTO public.project_scores (event_id, round_number) VALUES ('{EVENT}', {round_number});")


def assert_rejected(result):
    assert result.returncode != 0 and "not the active judging round" in result.stderr, result.stderr


def assert_allowed(result):
    assert result.returncode == 0, result.stderr


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
        sql("CREATE ROLE authenticated NOLOGIN;")

        # A schema without round_number must not get a trigger that breaks writes.
        sql("CREATE TABLE public.events (event_id uuid PRIMARY KEY, scoring_config jsonb);"
            "CREATE TABLE public.project_scores (id serial PRIMARY KEY, event_id uuid);")
        sql(migration)
        assert sql("SELECT count(*) FROM pg_trigger WHERE tgname = 'enforce_project_score_active_round';").stdout.strip() == "0"
        sql("DROP TABLE public.project_scores; DROP TABLE public.events;")

        sql(SCHEMA)
        sql(migration)
        sql(migration)  # Must be safe to re-apply.
        assert sql("SELECT count(*) FROM pg_trigger WHERE tgname = 'enforce_project_score_active_round';").stdout.strip() == "1"
        sql(f"INSERT INTO public.events VALUES ('{EVENT}', '{{\"activeRound\": 1}}');")
        assert_allowed(insert_round(1))

        # The bug: the organizer moves on and an open tab still writes round 1.
        set_config("""'{"activeRound": 2}'""")
        assert_rejected(insert_round(1))
        assert_rejected(judge("UPDATE public.project_scores SET comments = 'late' WHERE round_number = 1;"))
        assert_allowed(insert_round(2))
        assert_allowed(judge("UPDATE public.project_scores SET comments = 'current' WHERE round_number = 2;"))

        # Same defaults as getActiveRound(): anything unusable means round 1.
        for config in ("NULL", "'{}'", """'{"activeRound": "2"}'""", """'{"activeRound": 0}'"""):
            set_config(config)
            assert_allowed(insert_round(1))
            assert_rejected(insert_round(2))

        # Rows outside a readable event are left to RLS.
        missing = judge("INSERT INTO public.project_scores (event_id, round_number) VALUES (NULL, 5);")
        assert_allowed(missing)

        # Repairs and foreign-key actions are not judge writes.
        set_config("""'{"activeRound": 2}'""")
        sql("UPDATE public.project_scores SET comments = 'repaired' WHERE round_number = 1;")
        sql("INSERT INTO public.project_scores (event_id, round_number) VALUES "
            f"('{EVENT}', 1);")
        sql(f"DELETE FROM public.events WHERE event_id = '{EVENT}';")
        print("PASS: stale-round writes rejected, active round allowed, defaults match, repairs exempt, migration idempotent")
    finally:
        docker("rm", "--force", CONTAINER, check=False)


if __name__ == "__main__":
    main()
