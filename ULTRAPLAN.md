# ULTRAPLAN — Issue #704: Mentor Time Booking (MVP)

## Goal
Let mentors expose availability windows on an event, and let participants book
open slots without double-booking.

## Data Model

### `mentor_availability`
- `id UUID PK`
- `mentor_id UUID NOT NULL REFERENCES user_profiles(uid) ON DELETE CASCADE`
- `event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE`
- `start_time TIMESTAMPTZ NOT NULL`
- `end_time TIMESTAMPTZ NOT NULL`
- `max_bookings INT NOT NULL DEFAULT 1` (supports group office hours)
- `created_at TIMESTAMPTZ DEFAULT now()`
- `CHECK (end_time > start_time)`
- `CHECK (max_bookings >= 1)`
- Indexes: `(event_id, start_time)`, `(mentor_id, event_id)`

### `mentor_bookings`
- `id UUID PK`
- `availability_id UUID NOT NULL REFERENCES mentor_availability(id) ON DELETE CASCADE`
- `participant_id UUID NOT NULL REFERENCES user_profiles(uid) ON DELETE CASCADE`
- `status TEXT NOT NULL DEFAULT 'confirmed'`
- `booked_at TIMESTAMPTZ DEFAULT now()`
- `UNIQUE (availability_id, participant_id)`
- Indexes: `(availability_id)`, `(participant_id)`

### Double-booking prevention
- `UNIQUE (availability_id, participant_id)` blocks same-participant double-book.
- Server POST counts active bookings for `availability_id` and rejects if `>= max_bookings`.
- Follow-up: wrap in `SECURITY DEFINER` RPC for atomicity.

## RLS Policies
- `mentor_availability`
  - SELECT: any user with a role on the event.
  - INSERT/UPDATE/DELETE: `auth.uid() = mentor_id` with mentor role; organizers/admins allowed.
- `mentor_bookings`
  - SELECT: booking's participant, the slot's mentor, organizers, admins.
  - INSERT: `auth.uid() = participant_id` with event role.
  - UPDATE/DELETE: booking's participant, organizers, admins.

## API Routes
- `app/api/events/[eventId]/mentor-availability/route.ts` — `GET`, `POST`, `DELETE`
- `app/api/events/[eventId]/mentor-bookings/route.ts` — `GET`, `POST`, `DELETE`

## Pages
- `app/events/[id]/mentors/availability/page.tsx` — mentor creates/lists/deletes slots.
- `app/events/[id]/mentors/book/page.tsx` — participant views open slots grouped by mentor, books, cancels own.

## Types
`lib/types/mentor-booking.ts` — `MentorAvailability`, `MentorBooking`,
`MentorAvailabilityWithBookings`, `BookingStatus`.

## Out of Scope (follow-up issues)
- Email/notifications on book/cancel.
- Overlap detection in a mentor's own slots.
- Edit-in-place (currently delete + recreate).
- Calendar export / timezone UI.
- Atomic capacity via RPC.

## Commit Plan
1. ULTRAPLAN.md.
2. SQL migration.
3. TS types.
4. API routes.
5. Pages.
6. Typecheck fixes.
