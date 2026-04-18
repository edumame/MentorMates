-- Mentor time booking (issue #704)
-- Two tables: mentor_availability (slots) and mentor_bookings (participant reservations).

-- ============================================================
-- mentor_availability
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mentor_availability (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mentor_id UUID NOT NULL REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    max_bookings INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT mentor_availability_time_range CHECK (end_time > start_time),
    CONSTRAINT mentor_availability_max_bookings_positive CHECK (max_bookings >= 1)
);

CREATE INDEX IF NOT EXISTS idx_mentor_availability_event_time
    ON public.mentor_availability(event_id, start_time);
CREATE INDEX IF NOT EXISTS idx_mentor_availability_mentor_event
    ON public.mentor_availability(mentor_id, event_id);

COMMENT ON TABLE public.mentor_availability IS 'Mentor-advertised time windows during which participants can book a session.';
COMMENT ON COLUMN public.mentor_availability.max_bookings IS 'Capacity of the slot; default 1 for 1:1, >1 for group office hours.';

-- ============================================================
-- mentor_bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mentor_bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    availability_id UUID NOT NULL REFERENCES public.mentor_availability(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.user_profiles(uid) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'confirmed',
    booked_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT mentor_bookings_status_check CHECK (status IN ('confirmed', 'cancelled')),
    UNIQUE (availability_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_mentor_bookings_availability
    ON public.mentor_bookings(availability_id);
CREATE INDEX IF NOT EXISTS idx_mentor_bookings_participant
    ON public.mentor_bookings(participant_id);

COMMENT ON TABLE public.mentor_bookings IS 'Participant bookings against mentor_availability slots.';

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.mentor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_bookings ENABLE ROW LEVEL SECURITY;

-- mentor_availability: anyone with a role on the event can read slots.
DROP POLICY IF EXISTS "Event members can view availability" ON public.mentor_availability;
CREATE POLICY "Event members can view availability"
    ON public.mentor_availability
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_event_roles uer
            WHERE uer.event_id = mentor_availability.event_id
              AND uer.user_id = auth.uid()
        )
        OR is_admin_user(auth.uid())
    );

-- mentor_availability: mentors manage their own rows (must have mentor role on event).
DROP POLICY IF EXISTS "Mentor manages own availability" ON public.mentor_availability;
CREATE POLICY "Mentor manages own availability"
    ON public.mentor_availability
    FOR ALL
    USING (
        (
            auth.uid() = mentor_id
            AND EXISTS (
                SELECT 1 FROM public.user_event_roles uer
                WHERE uer.event_id = mentor_availability.event_id
                  AND uer.user_id = auth.uid()
                  AND uer.role = 'mentor'
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.user_event_roles uer
            WHERE uer.event_id = mentor_availability.event_id
              AND uer.user_id = auth.uid()
              AND uer.role = 'organizer'
        )
        OR is_admin_user(auth.uid())
    )
    WITH CHECK (
        (
            auth.uid() = mentor_id
            AND EXISTS (
                SELECT 1 FROM public.user_event_roles uer
                WHERE uer.event_id = mentor_availability.event_id
                  AND uer.user_id = auth.uid()
                  AND uer.role = 'mentor'
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.user_event_roles uer
            WHERE uer.event_id = mentor_availability.event_id
              AND uer.user_id = auth.uid()
              AND uer.role = 'organizer'
        )
        OR is_admin_user(auth.uid())
    );

-- mentor_bookings: participant, slot-owner mentor, organizer, admin can read.
DROP POLICY IF EXISTS "View mentor bookings" ON public.mentor_bookings;
CREATE POLICY "View mentor bookings"
    ON public.mentor_bookings
    FOR SELECT
    USING (
        auth.uid() = participant_id
        OR EXISTS (
            SELECT 1 FROM public.mentor_availability ma
            WHERE ma.id = mentor_bookings.availability_id
              AND ma.mentor_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.mentor_availability ma
            JOIN public.user_event_roles uer ON uer.event_id = ma.event_id
            WHERE ma.id = mentor_bookings.availability_id
              AND uer.user_id = auth.uid()
              AND uer.role = 'organizer'
        )
        OR is_admin_user(auth.uid())
    );

-- mentor_bookings: participants create their own bookings; they must have a role on the event.
DROP POLICY IF EXISTS "Participant creates own booking" ON public.mentor_bookings;
CREATE POLICY "Participant creates own booking"
    ON public.mentor_bookings
    FOR INSERT
    WITH CHECK (
        auth.uid() = participant_id
        AND EXISTS (
            SELECT 1 FROM public.mentor_availability ma
            JOIN public.user_event_roles uer ON uer.event_id = ma.event_id
            WHERE ma.id = mentor_bookings.availability_id
              AND uer.user_id = auth.uid()
        )
    );

-- mentor_bookings: participant can cancel/delete own; organizers/admins always.
DROP POLICY IF EXISTS "Update own booking" ON public.mentor_bookings;
CREATE POLICY "Update own booking"
    ON public.mentor_bookings
    FOR UPDATE
    USING (
        auth.uid() = participant_id
        OR EXISTS (
            SELECT 1 FROM public.mentor_availability ma
            JOIN public.user_event_roles uer ON uer.event_id = ma.event_id
            WHERE ma.id = mentor_bookings.availability_id
              AND uer.user_id = auth.uid()
              AND uer.role = 'organizer'
        )
        OR is_admin_user(auth.uid())
    );

DROP POLICY IF EXISTS "Delete own booking" ON public.mentor_bookings;
CREATE POLICY "Delete own booking"
    ON public.mentor_bookings
    FOR DELETE
    USING (
        auth.uid() = participant_id
        OR EXISTS (
            SELECT 1 FROM public.mentor_availability ma
            JOIN public.user_event_roles uer ON uer.event_id = ma.event_id
            WHERE ma.id = mentor_bookings.availability_id
              AND uer.user_id = auth.uid()
              AND uer.role = 'organizer'
        )
        OR is_admin_user(auth.uid())
    );
