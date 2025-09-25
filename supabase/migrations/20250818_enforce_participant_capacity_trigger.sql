-- Enforce participant capacity at the database level to avoid race conditions
CREATE OR REPLACE FUNCTION public.enforce_participant_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cap integer;
  current_count integer;
BEGIN
  -- Only enforce for participant role
  IF NEW.role <> 'participant'::public.event_role THEN
    RETURN NEW;
  END IF;

  -- Fetch capacity for the event
  SELECT participant_capacity
  INTO cap
  FROM public.events
  WHERE event_id = NEW.event_id;

  -- If no capacity set, allow
  IF cap IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count current participants for this event
  IF TG_OP = 'UPDATE' THEN
    SELECT COUNT(*)
    INTO current_count
    FROM public.user_event_roles
    WHERE event_id = NEW.event_id
      AND role = 'participant'::public.event_role
      AND id <> NEW.id; -- exclude self on updates
  ELSE
    SELECT COUNT(*)
    INTO current_count
    FROM public.user_event_roles
    WHERE event_id = NEW.event_id
      AND role = 'participant'::public.event_role;
  END IF;

  IF current_count >= cap THEN
    RAISE EXCEPTION 'Event is full. No seats available.' USING ERRCODE = '45000';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_participant_capacity_insert ON public.user_event_roles;
CREATE TRIGGER trg_enforce_participant_capacity_insert
BEFORE INSERT ON public.user_event_roles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_participant_capacity();

DROP TRIGGER IF EXISTS trg_enforce_participant_capacity_update ON public.user_event_roles;
CREATE TRIGGER trg_enforce_participant_capacity_update
BEFORE UPDATE OF role, event_id ON public.user_event_roles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_participant_capacity();

