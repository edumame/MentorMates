-- Migration: Repoint foreign keys from user_profiles.uid to user_profiles.id
-- Description: Backfills child table user references to the stable profile id,
-- preserves existing constraint names, and removes overlapping auth.users FKs
-- on the same columns so profile-backed relationships can own user identity.

DO $$
DECLARE
  v_uid_attnum smallint;
  fk_record record;
  sibling_fk record;
  update_action text;
  delete_action text;
  deferrable_clause text;
BEGIN
  SELECT attnum
  INTO v_uid_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.user_profiles'::regclass
    AND attname = 'uid'
    AND NOT attisdropped;

  IF v_uid_attnum IS NULL THEN
    RAISE EXCEPTION 'public.user_profiles.uid was not found';
  END IF;

  FOR fk_record IN
    SELECT
      con.oid,
      con.conname,
      con.conrelid,
      ns.nspname AS schema_name,
      cls.relname AS table_name,
      att.attname AS column_name,
      con.confupdtype,
      con.confdeltype,
      con.condeferrable,
      con.condeferred
    FROM pg_constraint con
    JOIN pg_class cls
      ON cls.oid = con.conrelid
    JOIN pg_namespace ns
      ON ns.oid = cls.relnamespace
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.user_profiles'::regclass
      AND con.confkey = ARRAY[v_uid_attnum]::smallint[]
      AND array_length(con.conkey, 1) = 1
      AND cls.relkind = 'r'
    ORDER BY ns.nspname, cls.relname, con.conname
  LOOP
    -- Drop same-column auth.users FKs first so the backfill from auth uid to
    -- profile id can happen without violating the old auth-based reference.
    FOR sibling_fk IN
      SELECT conname
      FROM pg_constraint
      WHERE contype = 'f'
        AND conrelid = fk_record.conrelid
        AND conkey = ARRAY[
          (
            SELECT attnum
            FROM pg_attribute
            WHERE attrelid = fk_record.conrelid
              AND attname = fk_record.column_name
              AND NOT attisdropped
          )
        ]::smallint[]
        AND confrelid = 'auth.users'::regclass
    LOOP
      EXECUTE format(
        'ALTER TABLE %I.%I DROP CONSTRAINT %I',
        fk_record.schema_name,
        fk_record.table_name,
        sibling_fk.conname
      );
    END LOOP;

    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT %I',
      fk_record.schema_name,
      fk_record.table_name,
      fk_record.conname
    );

    EXECUTE format(
      'UPDATE %I.%I AS child
       SET %I = up.id
       FROM public.user_profiles AS up
       WHERE child.%I = up.uid',
      fk_record.schema_name,
      fk_record.table_name,
      fk_record.column_name,
      fk_record.column_name
    );

    update_action := CASE fk_record.confupdtype
      WHEN 'a' THEN 'NO ACTION'
      WHEN 'r' THEN 'RESTRICT'
      WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT'
      ELSE 'NO ACTION'
    END;

    delete_action := CASE fk_record.confdeltype
      WHEN 'a' THEN 'NO ACTION'
      WHEN 'r' THEN 'RESTRICT'
      WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT'
      ELSE 'NO ACTION'
    END;

    deferrable_clause := CASE
      WHEN fk_record.condeferrable AND fk_record.condeferred THEN ' DEFERRABLE INITIALLY DEFERRED'
      WHEN fk_record.condeferrable THEN ' DEFERRABLE INITIALLY IMMEDIATE'
      ELSE ''
    END;

    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.user_profiles(id) ON UPDATE %s ON DELETE %s%s',
      fk_record.schema_name,
      fk_record.table_name,
      fk_record.conname,
      fk_record.column_name,
      update_action,
      delete_action,
      deferrable_clause
    );
  END LOOP;
END;
$$;
