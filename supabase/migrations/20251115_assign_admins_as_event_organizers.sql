BEGIN;

-- Helper function to ensure all platform admins are added to an event
CREATE OR REPLACE FUNCTION public.assign_admins_as_event_organizers(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    admin_record RECORD;
BEGIN
    FOR admin_record IN
        SELECT up.uid AS admin_id
        FROM public.user_profiles up
        WHERE public.is_admin_user(up.uid)
    LOOP
        INSERT INTO public.user_event_roles (user_id, event_id, role, created_at, updated_at)
        VALUES (admin_record.admin_id, p_event_id, 'admin', timezone('utc', now()), timezone('utc', now()))
        ON CONFLICT (user_id, event_id) DO UPDATE
            SET role = 'admin',
                updated_at = timezone('utc', now());
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.assign_admins_as_event_organizers(uuid)
IS 'Ensures every global admin receives an admin role for the supplied event.';

-- Trigger function to assign admins whenever a new event is created
CREATE OR REPLACE FUNCTION public.handle_event_admin_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM public.assign_admins_as_event_organizers(NEW.event_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_admins_are_event_organizers ON public.events;

CREATE TRIGGER ensure_admins_are_event_organizers
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_admin_assignment();

-- Backfill admins for all existing events
DO $$
DECLARE
    event_record RECORD;
BEGIN
    FOR event_record IN SELECT event_id FROM public.events LOOP
        PERFORM public.assign_admins_as_event_organizers(event_record.event_id);
    END LOOP;
END;
$$;

COMMIT;
