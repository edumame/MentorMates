-- MENT-013: feedback.created_at and projects.created_at were
-- `timestamp without time zone` holding UTC wall-clock values
-- (default now() AT TIME ZONE 'utc'). PostgREST returned them without an
-- offset and browsers parsed them as local time ("in about 8 hours",
-- next-day dates). Convert to timestamptz, interpreting stored values as UTC.
-- Idempotent: only converts while the column is still without time zone.
--
-- PROD: ALTER COLUMN TYPE rewrites both tables and rebuilds their indexes
-- under an ACCESS EXCLUSIVE lock. Run in a low-traffic window. lock_timeout
-- makes it fail fast (and roll back atomically) instead of queueing behind a
-- long reader and blocking all project/feedback traffic; just re-run later.
--
-- PROD PRE-CHECK (read-only):
--   -- views/rules depending on the columns (ALTER fails if any exist)
--   select distinct dv.relname as dependent_view, src.relname as source_table
--     from pg_depend d
--     join pg_rewrite r on d.objid = r.oid
--     join pg_class dv on r.ev_class = dv.oid
--     join pg_class src on d.refobjid = src.oid
--    where src.relname in ('projects', 'feedback') and dv.relname <> src.relname;
--   -- current types and sizes
--   select table_name, data_type from information_schema.columns
--    where table_schema = 'public' and table_name in ('projects','feedback') and column_name = 'created_at';
--   select count(*) from public.projects; select count(*) from public.feedback;
--
-- PROD SNAPSHOT (XL-008, optional, run by hand before this migration; the
-- rewrite is lossless, but this keeps the original wall-clock values):
--   create schema if not exists audit_backup;
--   revoke all on schema audit_backup from public, anon, authenticated;
--   create table if not exists audit_backup.created_at_20261108 as
--     select 'projects'::text as source_table, id, created_at::text as created_at_raw from public.projects
--     union all
--     select 'feedback'::text, id, created_at::text from public.feedback;
--   revoke all on audit_backup.created_at_20261108 from public, anon, authenticated;

set local lock_timeout = '5s';
set local statement_timeout = '5min';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'feedback'
      and column_name = 'created_at' and data_type = 'timestamp without time zone'
  ) then
    alter table public.feedback
      alter column created_at type timestamptz using created_at at time zone 'UTC',
      alter column created_at set default now();
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects'
      and column_name = 'created_at' and data_type = 'timestamp without time zone'
  ) then
    alter table public.projects
      alter column created_at type timestamptz using created_at at time zone 'UTC',
      alter column created_at set default now();
  end if;
end
$$;

-- PostgREST caches column types.
notify pgrst, 'reload schema';
