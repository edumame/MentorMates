-- shipcue report queue (github.com/cyu60/shipcue v0.3.1, sql/schema.sql).
-- Bug reports, feature requests and agent tasks filed from the in-app report
-- button; coding agents work the queue over MCP through /api/shipcue.
--
-- Access: the /api/shipcue handler uses the service role. RLS is on with no
-- policies, and anon/authenticated have no grants, so browsers cannot read or
-- write this table directly.

CREATE TABLE IF NOT EXISTS shipcue_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text NOT NULL CHECK (type IN ('bug', 'feature', 'task')),
  priority      text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'blocking')),
  -- Sorts the queue: blocking first. Kept in step with priority by the database.
  priority_rank smallint GENERATED ALWAYS AS (
    CASE priority WHEN 'blocking' THEN 3 WHEN 'high' THEN 2 WHEN 'medium' THEN 1 ELSE 0 END
  ) STORED,
  area          text NOT NULL,
  description   text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 20000),
  page_url      text NOT NULL DEFAULT '' CHECK (length(page_url) <= 500),
  user_agent    text NOT NULL DEFAULT '' CHECK (length(user_agent) <= 300),
  diagnostics   jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(diagnostics) <= 65536),
  -- Screenshot URLs, or small data URLs when you have no file storage.
  screenshots   text[] NOT NULL DEFAULT '{}',
  reporter      text,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'fixed', 'wontfix')),
  claimed_by    text,
  claimed_at    timestamptz,
  resolution    text,
  -- A screen recording or video URL, attached after the report is filed.
  video         text,
  -- Text picked out on the page (a selection or selected blocks) the report is about.
  context       text CHECK (length(context) <= 20000),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Soft delete: rows are hidden, never removed.
  is_deleted    boolean NOT NULL DEFAULT false,
  deleted_at    timestamptz
);

-- Upgrading from 0.1: add the video column to an existing table.
ALTER TABLE shipcue_reports ADD COLUMN IF NOT EXISTS video text;

-- Upgrading from 0.2: allow agent tasks, and keep the picked-out context.
ALTER TABLE shipcue_reports ADD COLUMN IF NOT EXISTS context text CHECK (length(context) <= 20000);
ALTER TABLE shipcue_reports DROP CONSTRAINT IF EXISTS shipcue_reports_type_check;
ALTER TABLE shipcue_reports ADD CONSTRAINT shipcue_reports_type_check CHECK (type IN ('bug', 'feature', 'task'));

CREATE INDEX IF NOT EXISTS shipcue_reports_queue
  ON shipcue_reports (status, priority_rank DESC, created_at)
  WHERE NOT is_deleted;

ALTER TABLE shipcue_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE shipcue_reports FROM anon, authenticated;

-- Atomically take the most urgent open report (the same query as shipcue's
-- postgresStore.claimNext). SKIP LOCKED: two agents asking at once get two
-- different reports. Called over RPC by lib/shipcue/supabase-store.ts.
CREATE OR REPLACE FUNCTION public.shipcue_claim_next(p_agent text)
RETURNS SETOF public.shipcue_reports
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE shipcue_reports
     SET status = 'claimed', claimed_by = p_agent, claimed_at = now(), updated_at = now()
   WHERE id = (
     SELECT id FROM shipcue_reports
      WHERE status = 'open' AND NOT is_deleted
      ORDER BY priority_rank DESC, created_at, id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.shipcue_claim_next(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shipcue_claim_next(text) TO service_role;
