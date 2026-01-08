-- Allow admin users to update/delete meetings (conversations) regardless of ownership.
-- This supports admin-only editing/deleting of conversations with agents.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='meetings'
      AND policyname='Admins can update meetings'
  ) THEN
    CREATE POLICY "Admins can update meetings"
    ON public.meetings
    AS PERMISSIVE
    FOR UPDATE
    TO authenticated
    USING (public.is_admin_user(auth.uid()))
    WITH CHECK (public.is_admin_user(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='meetings'
      AND policyname='Admins can delete meetings'
  ) THEN
    CREATE POLICY "Admins can delete meetings"
    ON public.meetings
    AS PERMISSIVE
    FOR DELETE
    TO authenticated
    USING (public.is_admin_user(auth.uid()));
  END IF;
END $$;

