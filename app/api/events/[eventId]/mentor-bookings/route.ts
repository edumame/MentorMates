import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { BookingStatus } from "@/lib/types/mentor-booking";

const createSchema = z.object({
  availability_id: z.string().uuid(),
});

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

// GET — list bookings the caller can see (own + own mentor slots).
export async function GET(
  _request: NextRequest,
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

    const service = createSupabaseServiceClient();

    const { data: eventSlots, error: slotsErr } = await service
      .from("mentor_availability")
      .select("id, mentor_id, event_id, start_time, end_time, max_bookings")
      .eq("event_id", eventId);

    if (slotsErr) {
      console.error("slots fetch error", slotsErr);
      return NextResponse.json(
        { error: "Failed to load bookings" },
        { status: 500 }
      );
    }

    const slotIds = (eventSlots ?? []).map((s) => s.id);
    if (slotIds.length === 0) {
      return NextResponse.json({ bookings: [] });
    }

    let query = service
      .from("mentor_bookings")
      .select("*")
      .in("availability_id", slotIds)
      .order("booked_at", { ascending: false });

    const isModerator =
      role === EventRole.Organizer || role === EventRole.Admin;

    if (!isModerator) {
      // Mentors see bookings against their own slots; everyone else sees own bookings.
      const ownSlotIds = (eventSlots ?? [])
        .filter((s) => s.mentor_id === user.id)
        .map((s) => s.id);

      if (ownSlotIds.length > 0) {
        query = service
          .from("mentor_bookings")
          .select("*")
          .in("availability_id", slotIds)
          .or(
            `participant_id.eq.${user.id},availability_id.in.(${ownSlotIds.join(
              ","
            )})`
          )
          .order("booked_at", { ascending: false });
      } else {
        query = service
          .from("mentor_bookings")
          .select("*")
          .eq("participant_id", user.id)
          .in("availability_id", slotIds)
          .order("booked_at", { ascending: false });
      }
    }

    const { data: bookings, error: bookErr } = await query;
    if (bookErr) {
      console.error("bookings fetch error", bookErr);
      return NextResponse.json(
        { error: "Failed to load bookings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ bookings: bookings ?? [] });
  } catch (error) {
    console.error("mentor-bookings GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST — participant books a slot. Server-side capacity + duplicate check.
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
    if (!role) {
      return NextResponse.json(
        { error: "You must be a member of this event to book" },
        { status: 403 }
      );
    }
    // MENT-004: staff must not consume participant capacity (also enforced
    // in book_mentor_slot).
    if (role !== EventRole.Participant) {
      return NextResponse.json(
        { error: "Only participants can book mentor sessions" },
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
    const { availability_id } = parsed.data;

    const { data: booking, error } = await supabase.rpc("book_mentor_slot", {
      p_event_id: eventId, p_availability_id: availability_id,
    });
    if (error) {
      const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 :
        ["23514", "23505"].includes(error.code) ? 409 : error.code === "22023" ? 400 : 500;
      return NextResponse.json({ error: status === 500 ? "Failed to book slot" : error.message }, { status });
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    console.error("mentor-bookings POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE — cancel a booking (participant, slot-owner mentor, or organizer/admin).
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const { user, role } = await getUserAndRole(eventId);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const service = createSupabaseServiceClient();
    const { data: booking, error: bookErr } = await service
      .from("mentor_bookings")
      .select("id, participant_id, availability_id")
      .eq("id", id)
      .single();
    if (bookErr || !booking) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: slot } = await service
      .from("mentor_availability")
      .select("event_id, mentor_id")
      .eq("id", booking.availability_id)
      .single();

    if (!slot || slot.event_id !== eventId) {
      return NextResponse.json({ error: "Event mismatch" }, { status: 400 });
    }

    // The participant, the mentor who owns the slot, or an organizer/admin
    // may cancel (MENT-005: slot owners used to get 403).
    const isParticipant = booking.participant_id === user.id;
    const isSlotOwner = slot.mentor_id === user.id;
    const canModerate =
      role === EventRole.Organizer || role === EventRole.Admin;
    if (!isParticipant && !isSlotOwner && !canModerate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Keep the row as 'cancelled' (an audit trail both sides can see) rather
    // than hard-deleting; booking again re-confirms it via book_mentor_slot.
    // Direct UPDATE is revoked from clients, so the authorised change goes
    // through the service client.
    const { error: cancelErr } = await service
      .from("mentor_bookings")
      .update({ status: BookingStatus.Cancelled })
      .eq("id", id);

    if (cancelErr) {
      console.error("booking cancel error", cancelErr);
      return NextResponse.json(
        { error: "Failed to cancel booking" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("mentor-bookings DELETE error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
