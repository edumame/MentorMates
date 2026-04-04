-- Migration: Merge pre-existing user_profiles rows when a matching auth user is created
-- Description: On auth.users insert, if a user_profiles row already exists for the same email,
-- move that profile and all foreign-key references from the old uid to the new auth user id.

-- Make every FK pointing at user_profiles(uid) deferrable so the merge can
-- temporarily update the parent uid and child references in one transaction.
DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT conrelid::regclass AS table_name, conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = 'public.user_profiles'::regclass
      AND NOT condeferrable
  LOOP
    EXECUTE format(
      'ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY IMMEDIATE',
      constraint_record.table_name,
      constraint_record.conname
    );
  END LOOP;
END;
$$;

-- Rewrite every single-column FK that references user_profiles(uid) from the
-- old profile id to the new auth-backed profile id.
CREATE OR REPLACE FUNCTION public.repoint_user_profile_references(
  p_old_user_id uuid,
  p_new_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  reference_record record;
BEGIN
  IF p_old_user_id IS NULL OR p_new_user_id IS NULL OR p_old_user_id = p_new_user_id THEN
    RETURN;
  END IF;

  FOR reference_record IN
    SELECT
      ns.nspname AS schema_name,
      cls.relname AS table_name,
      att.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class cls
      ON cls.oid = con.conrelid
    JOIN pg_namespace ns
      ON ns.oid = cls.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord)
      ON true
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = cols.attnum
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.user_profiles'::regclass
      AND array_length(con.conkey, 1) = 1
      AND cls.relkind = 'r'
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = $1 WHERE %I = $2',
      reference_record.schema_name,
      reference_record.table_name,
      reference_record.column_name,
      reference_record.column_name
    )
    USING p_new_user_id, p_old_user_id;
  END LOOP;
END;
$$;

-- On auth signup, either create a fresh profile row or merge an existing
-- email-matched profile onto the new auth.users id.
CREATE OR REPLACE FUNCTION public.merge_user_profile_on_auth_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_existing_uid uuid;
  v_display_name text;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  v_display_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(NEW.email, '@', 1)
  );

  SELECT up.uid
  INTO v_existing_uid
  FROM public.user_profiles up
  WHERE lower(up.email) = lower(NEW.email)
    AND up.uid <> NEW.id
  ORDER BY up.created_at NULLS FIRST, up.uid
  LIMIT 1
  FOR UPDATE;

  IF v_existing_uid IS NULL THEN
    INSERT INTO public.user_profiles (
      uid,
      email,
      display_name,
      created_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      v_display_name,
      COALESCE(NEW.created_at, now())
    )
    ON CONFLICT (uid) DO UPDATE
    SET
      email = EXCLUDED.email,
      display_name = COALESCE(public.user_profiles.display_name, EXCLUDED.display_name);

    RETURN NEW;
  END IF;

  SET CONSTRAINTS ALL DEFERRED;

  UPDATE public.user_profiles
  SET uid = NEW.id
  WHERE uid = v_existing_uid;

  PERFORM public.repoint_user_profile_references(v_existing_uid, NEW.id);

  RETURN NEW;
END;
$$;

-- Install the auth.users trigger idempotently so rerunning the migration
-- definition replaces any prior version of this trigger.
DROP TRIGGER IF EXISTS trg_merge_user_profile_on_auth_insert ON auth.users;
CREATE TRIGGER trg_merge_user_profile_on_auth_insert
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.merge_user_profile_on_auth_insert();
