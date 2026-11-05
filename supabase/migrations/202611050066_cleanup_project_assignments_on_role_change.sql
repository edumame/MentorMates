-- project_assignments had no link to user_event_roles, so a judge or mentor who
-- was removed from an event or moved to another role stayed assigned to projects
-- they could no longer serve. Roles are written from many routes (organizer and
-- agent participant routes, role verification, participant join, refunds), so the
-- rule lives on the table rather than in each caller.
--
-- A user can hold an assignment only while their event role is the assignment's
-- role, or organizer/admin: organizers can be assigned as judges and mentors.
--
-- SECURITY DEFINER because the caller may be a global admin with no event role,
-- whom the "Organizers can manage assignments" RLS policy would silently block.

CREATE OR REPLACE FUNCTION public.cleanup_project_assignments_on_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.project_assignments pa
    WHERE pa.event_id = OLD.event_id
      AND pa.user_id = OLD.user_id;

    RETURN OLD;
  END IF;

  IF NEW.role::text NOT IN ('organizer', 'admin') THEN
    DELETE FROM public.project_assignments pa
    WHERE pa.event_id = NEW.event_id
      AND pa.user_id = NEW.user_id
      AND pa.role::text <> NEW.role::text;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.project_assignments') IS NULL
    OR to_regclass('public.user_event_roles') IS NULL THEN
    RAISE NOTICE 'Skipping project assignment cleanup: required table is missing';
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS user_event_roles_project_assignment_cleanup_trigger
    ON public.user_event_roles;

  CREATE TRIGGER user_event_roles_project_assignment_cleanup_trigger
  AFTER UPDATE OF role OR DELETE
  ON public.user_event_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_project_assignments_on_role_change();

  -- Remove rows already left behind by earlier role changes.
  DELETE FROM public.project_assignments pa
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_event_roles uer
    WHERE uer.event_id = pa.event_id
      AND uer.user_id = pa.user_id
      AND (
        uer.role::text = pa.role::text
        OR uer.role::text IN ('organizer', 'admin')
      )
  );
END;
$$;
