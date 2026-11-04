-- Limit anon to the public display columns on events: a column-level grant
-- covering every column except paywall_content and the public-submit contact
-- fields.
--
-- The column list is read from the catalog so this works on a schema that
-- differs from the repo, and it can be re-run: revoking the table privilege
-- also clears earlier column grants.
--
-- Columns added later are not readable by anon until they are granted.
-- `authenticated` is unchanged: the organizer dashboard and admin review read
-- these columns through the browser client.
DO $$
DECLARE
  anon_columns text;
BEGIN
  IF to_regclass('public.events') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    RETURN;
  END IF;

  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
  INTO anon_columns
  FROM pg_attribute
  WHERE attrelid = 'public.events'::regclass
    AND attnum > 0
    AND NOT attisdropped
    AND attname NOT IN (
      'paywall_content',
      'submitter_email',
      'submitter_name',
      'organizer_affiliation'
    );

  REVOKE SELECT ON public.events FROM anon;
  EXECUTE format('GRANT SELECT (%s) ON public.events TO anon', anon_columns);
END
$$;
