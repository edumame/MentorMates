import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import type {
  MentorAvailability,
  MentorAvailabilityWithBookings,
  MentorProfileLite,
  UserProfileLite,
} from "@/lib/types/mentor-booking";
import { BookingStatus } from "@/lib/types/mentor-booking";
import { validateSlotTimes } from "@/features/events/mentor-bookings/utils";

// DB errors raised by the mentor_availability_guard trigger
// (migration 202611080502) for writes that bypass the checks below.
const SLOT_RULE_ERROR_CODES = new Set(["23514", "23P01"]);

const createSchema = z
  .object({
    start_time: z.string().datetime({ offset: true }),
    end_time: z.string().datetime({ offset: true }),
    max_bookings: z.coerce.number().int().min(1).max(50).default(1),
  })
  .refine(
    (v) => new Date(v.end_time).getTime() > new Date(v.start_time).getTime(),
    { message: "end_time must be after start_time", path: ["end_time"] }
  );

async function getUserAndRole(eventId: string) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { supabase, user: null, role: null };

  const { data: roleRow } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    role: (roleRow?.role as EventRole | undefined) ?? null,
  };
}

// GET — list all availability for the event (optionally filter by mentorId).
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const { user, role } = await getUserAndRole(eventId);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const mentorId = request.nextUrl.searchParams.get("mentorId") || undefined;
    const service = createSupabaseServiceClient();

    let query = service
      .from("mentor_availability")
      .select("*")
      .eq("event_id", eventId)
      // Cancelled (soft-deleted) slots stay in the DB with their cancelled bookings.
      .is("cancelled_at", null)
      .order("start_time", { ascending: true });

    if (mentorId) query = query.eq("mentor_id", mentorId);

    const { data: slots, error } = await query;
    if (error) {
      console.error("mentor_availability list error", error);
      return NextResponse.json(
        { error: "Failed to load availability" },
        { status: 500 }
      );
    }

    const availability = (slots ?? []) as MentorAvailability[];
    const slotIds = availability.map((s) => s.id);
    const mentorIds = Array.from(new Set(availability.map((s) => s.mentor_id)));

    const [bookingRes, mentorRes] = await Promise.all([
      slotIds.length
        ? service
            .from("mentor_bookings")
            .select("id, availability_id, participant_id, status")
            .in("availability_id", slotIds)
            .eq("status", BookingStatus.Confirmed)
        : Promise.resolve({ data: [], error: null } as {
            data: Array<{
              id: string;
              availability_id: string;
              participant_id: string;
              status: string;
            }>;
            error: null;
          }),
      mentorIds.length
        ? service
            .from("user_profiles")
            .select("uid, display_name, avatar_url")
            .in("uid", mentorIds)
        : Promise.resolve({ data: [], error: null } as {
            data: MentorProfileLite[];
            error: null;
          }),
      // Mentor emails are not exposed to event members (MENT-002); names and
      // avatars are enough to choose a session.
    ]);

    if (bookingRes.error || mentorRes.error) {
      return NextResponse.json({ error: "Failed to load availability details" }, { status: 500 });
    }
    const isModerator = role === EventRole.Organizer || role === EventRole.Admin;
    const visibleSlotIds = new Set(availability.filter(s => isModerator || s.mentor_id === user.id).map(s => s.id));
    const visibleBookings = (bookingRes.data ?? []).filter(b => visibleSlotIds.has(b.availability_id));
    const participantIds = Array.from(new Set(visibleBookings.map(b => b.participant_id)));
    const participantRes = participantIds.length ? await service
      .from("user_profiles").select("uid, display_name, email").in("uid", participantIds)
      : { data: [], error: null };
    if (participantRes.error) {
      return NextResponse.json({ error: "Failed to load attendees" }, { status: 500 });
    }
    const participantById = new Map((participantRes.data ?? []).map(p => [p.uid, { display_name: p.display_name, email: p.email }]));
    const participantsBySlot = new Map<string, UserProfileLite[]>();
    for (const booking of visibleBookings) {
      const profile = participantById.get(booking.participant_id);
      // booking_id lets the slot owner / organizer cancel one attendee (MENT-005).
      if (profile) participantsBySlot.set(booking.availability_id, [...(participantsBySlot.get(booking.availability_id) ?? []), { ...profile, booking_id: booking.id }]);
    }

    const countsBySlot = new Map<string, number>();
    const viewerBookingBySlot = new Map<string, string>();
    for (const b of bookingRes.data ?? []) {
      countsBySlot.set(
        b.availability_id,
        (countsBySlot.get(b.availability_id) ?? 0) + 1
      );
      if (b.participant_id === user.id) {
        viewerBookingBySlot.set(b.availability_id, b.id);
      }
    }

    const mentorById = new Map<string, MentorProfileLite>();
    for (const m of (mentorRes.data ?? []) as MentorProfileLite[]) {
      mentorById.set(m.uid, m);
    }

    const result: MentorAvailabilityWithBookings[] = availability.map((s) => ({
      ...s,
      booking_count: countsBySlot.get(s.id) ?? 0,
      viewer_booking_id: viewerBookingBySlot.get(s.id) ?? null,
      mentor: mentorById.get(s.mentor_id) ?? null,
      participants: participantsBySlot.get(s.id) ?? [],
    }));

    return NextResponse.json({ availability: result });
  } catch (error) {
    console.error("mentor-availability GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST — mentor creates a slot.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const { supabase, user, role } = await getUserAndRole(eventId);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (role !== EventRole.Mentor && role !== EventRole.Organizer && role !== EventRole.Admin) {
      return NextResponse.json(
        { error: "Only mentors can create availability" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { start_time, end_time, max_bookings } = parsed.data;

    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .select("submission_time_start, submission_time_cutoff")
      .eq("event_id", eventId)
      .maybeSingle();
    if (eventError) {
      console.error("mentor_availability event lookup error", eventError);
      return NextResponse.json({ error: "Failed to load event" }, { status: 500 });
    }
    const ruleError = validateSlotTimes(start_time, end_time, {
      start: eventRow?.submission_time_start,
      end: eventRow?.submission_time_cutoff,
    });
    if (ruleError) {
      return NextResponse.json({ error: ruleError }, { status: 400 });
    }

    const { data: overlapping, error: overlapError } = await supabase
      .from("mentor_availability")
      .select("id")
      .eq("event_id", eventId)
      .eq("mentor_id", user.id)
      .is("cancelled_at", null)
      .lt("start_time", end_time)
      .gt("end_time", start_time)
      .limit(1);
    if (overlapError) {
      console.error("mentor_availability overlap check error", overlapError);
      return NextResponse.json({ error: "Failed to create availability" }, { status: 500 });
    }
    if ((overlapping?.length ?? 0) > 0) {
      return NextResponse.json(
        { error: "This overlaps one of your existing availability slots" },
        { status: 409 }
      );
    }

    const { data: slot, error } = await supabase
      .from("mentor_availability")
      .insert({
        mentor_id: user.id,
        event_id: eventId,
        start_time,
        end_time,
        max_bookings,
      })
      .select()
      .single();

    if (error) {
      if (SLOT_RULE_ERROR_CODES.has(error.code)) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      console.error("mentor_availability insert error", error);
      return NextResponse.json(
        { error: "Failed to create availability" },
        { status: 500 }
      );
    }

    return NextResponse.json({ availability: slot }, { status: 201 });
  } catch (error) {
    console.error("mentor-availability POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE — mentor removes a slot (?force=true required when it has bookings).
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const { supabase, user, role } = await getUserAndRole(eventId);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const service = createSupabaseServiceClient();
    const { data: slot, error: slotErr } = await service
      .from("mentor_availability")
      .select("id, mentor_id, event_id")
      .eq("id", id)
      .single();

    if (slotErr || !slot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (slot.event_id !== eventId) {
      return NextResponse.json({ error: "Event mismatch" }, { status: 400 });
    }

    const isOwner = slot.mentor_id === user.id;
    const canModerate =
      role === EventRole.Organizer || role === EventRole.Admin;
    if (!isOwner && !canModerate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // MENT-005: cancel_mentor_slot locks the slot, refuses without force
    // while bookings exist, marks them cancelled and soft-deletes the slot
    // (cancelled booking rows are kept) - all in one transaction.
    const force = request.nextUrl.searchParams.get("force") === "true";
    const { data: cancelledRows, error: cancelErr } = await supabase.rpc(
      "cancel_mentor_slot" as never,
      { p_availability_id: id, p_force: force } as never
    );
    if (cancelErr) {
      if (cancelErr.code === "P0001") {
        const { count } = await service
          .from("mentor_bookings")
          .select("id", { count: "exact", head: true })
          .eq("availability_id", id)
          .eq("status", BookingStatus.Confirmed);
        const bookingCount = count ?? 0;
        return NextResponse.json(
          {
            error: `This slot has ${bookingCount} confirmed booking${bookingCount === 1 ? "" : "s"}. Confirm to cancel them and remove the slot.`,
            booking_count: bookingCount,
          },
          { status: 409 }
        );
      }
      if (cancelErr.code === "P0002") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (cancelErr.code === "42501") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      console.error("mentor_availability cancel error", cancelErr);
      return NextResponse.json(
        { error: "Failed to delete availability" },
        { status: 500 }
      );
    }

    const cancelledParticipants = ((cancelledRows ?? []) as Array<{ participant_id: string }>).map(
      (row) => row.participant_id
    );
    // Participants are not emailed yet (no template; needs product copy).
    return NextResponse.json({
      success: true,
      cancelled_booking_count: cancelledParticipants.length,
    });
  } catch (error) {
    console.error("mentor-availability DELETE error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
