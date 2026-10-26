-- Migration: Add a stable primary key to user_profiles and allow profiles to exist before auth signup
-- Description: Introduces user_profiles.id as the primary key, keeps uid as the auth.users link,
-- and updates the auth insert trigger to attach email-matched placeholder profiles.

-- Add a stable surrogate key so a profile row can exist before it is linked to auth.users.
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

UPDATE public.user_profiles
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.user_profiles
ALTER COLUMN id SET NOT NULL;

-- Preserve uniqueness on uid before switching the primary key away from it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_profiles'::regclass
      AND conname = 'user_profiles_uid_key'
  ) THEN
    ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_uid_key UNIQUE (uid);
  END IF;
END;
$$;

-- user_profiles.id becomes the stable primary key; uid remains a nullable auth reference.
ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_pkey;

ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);

ALTER TABLE public.user_profiles
ALTER COLUMN uid DROP NOT NULL;

COMMENT ON COLUMN public.user_profiles.id IS
  'Stable user profile primary key. This row can exist before an auth.users account is linked.';

COMMENT ON COLUMN public.user_profiles.uid IS
  'Linked auth.users.id for registered users. Nullable so invite/pre-created profiles can exist before signup.';

-- Rewrite every single-column FK that references user_profiles(uid) from the
-- old auth-linked uid to the new auth-linked uid during profile merges.
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
      AND att.attname <> 'id'
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

-- On auth signup, either create a fresh profile row or attach the new auth user
-- to an existing email-matched placeholder profile.
CREATE OR REPLACE FUNCTION public.merge_user_profile_on_auth_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_existing_profile record;
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

  SELECT
    up.id,
    up.uid
  INTO v_existing_profile
  FROM public.user_profiles up
  WHERE lower(up.email) = lower(NEW.email)
  ORDER BY up.created_at NULLS FIRST, up.id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
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

  IF v_existing_profile.uid IS DISTINCT FROM NEW.id THEN
    SET CONSTRAINTS ALL DEFERRED;
  END IF;

  UPDATE public.user_profiles
  SET
    uid = NEW.id,
    email = NEW.email,
    display_name = COALESCE(public.user_profiles.display_name, v_display_name)
  WHERE id = v_existing_profile.id;

  PERFORM public.repoint_user_profile_references(v_existing_profile.uid, NEW.id);

  RETURN NEW;
END;
$$;
