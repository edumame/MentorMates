-- Make event and mentor-slot capacity hold under concurrency.
-- Each trigger locks the row that owns the limit before counting, so concurrent
-- writers queue and the later one counts the earlier one's committed row.
--
-- FOR NO KEY UPDATE serializes these triggers without blocking the FOR KEY SHARE
-- locks that foreign key checks take on the same row.
--
-- SECURITY DEFINER is required: under RLS a locking read also applies the table's
-- UPDATE policies, so a participant's lock on a row they cannot update would
-- silently return nothing and skip the limit. It also makes the counts see every
-- row rather than only the rows the caller may read.
--
-- The functions must stay VOLATILE so that the count takes a fresh snapshot after
-- the lock is acquired.
BEGIN;

-- Triggers below read this column, and production schema may trail the repo.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS participant_capacity integer;

CREATE OR REPLACE FUNCTION public.enforce_participant_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  cap integer;
  current_count integer;
BEGIN
  -- Only enforce for participant role
  IF NEW.role <> 'participant'::public.event_role THEN
    RETURN NEW;
  END IF;

  -- Unlocked first read, so joins to uncapped events do not queue on the event.
  SELECT participant_capacity
  INTO cap
  FROM public.events
  WHERE event_id = NEW.event_id;

  -- If no capacity set, allow
  IF cap IS NULL THEN
    RETURN NEW;
  END IF;

  -- Held until commit. Re-reads the capacity in case it changed during the wait.
  SELECT participant_capacity
  INTO cap
  FROM public.events
  WHERE event_id = NEW.event_id
  FOR NO KEY UPDATE;

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

REVOKE ALL ON FUNCTION public.enforce_participant_capacity() FROM PUBLIC, anon, authenticated;

-- Recreated because production may not have these triggers.
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

CREATE OR REPLACE FUNCTION public.enforce_mentor_booking_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  cap integer;
  current_count integer;
BEGIN
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- A booking that already holds its place takes no new one. This also lets a
  -- slot that was overbooked before this trigger existed keep working.
  IF TG_OP = 'UPDATE'
    AND OLD.status = 'confirmed'
    AND OLD.availability_id = NEW.availability_id THEN
    RETURN NEW;
  END IF;

  -- Held until commit.
  SELECT max_bookings
  INTO cap
  FROM public.mentor_availability
  WHERE id = NEW.availability_id
  FOR NO KEY UPDATE;

  -- A missing slot is left for the foreign key to reject.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO current_count
  FROM public.mentor_bookings
  WHERE availability_id = NEW.availability_id
    AND status = 'confirmed'
    AND id <> NEW.id; -- exclude self on updates

  IF current_count >= cap THEN
    RAISE EXCEPTION 'Slot is fully booked' USING ERRCODE = '45000';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_mentor_booking_capacity() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.mentor_bookings') IS NOT NULL
    AND to_regclass('public.mentor_availability') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_enforce_mentor_booking_capacity ON public.mentor_bookings;
    CREATE TRIGGER trg_enforce_mentor_booking_capacity
    BEFORE INSERT OR UPDATE OF status, availability_id ON public.mentor_bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_mentor_booking_capacity();
  END IF;
END;
$$;

COMMIT;
