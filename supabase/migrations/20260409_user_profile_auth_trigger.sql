CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_display_name text;
  v_normalized_email text;
BEGIN
  IF TG_OP <> 'INSERT' OR NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  v_normalized_email := lower(btrim(NEW.email));

  v_display_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(v_normalized_email, '@', 1)
  );

  INSERT INTO public.user_profiles (
    uid,
    email,
    display_name,
    created_at
  )
  VALUES (
    NEW.id,
    v_normalized_email,
    v_display_name,
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (email) DO UPDATE
  SET
    uid = EXCLUDED.uid,
    display_name = COALESCE(public.user_profiles.display_name, EXCLUDED.display_name);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();