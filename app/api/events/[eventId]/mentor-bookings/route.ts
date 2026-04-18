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

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { availability_id } = parsed.data;

    const service = createSupabaseServiceClient();

    // Verify slot belongs to event; fetch capacity.
    const { data: slot, error: slotErr } = await service
      .from("mentor_availability")
      .select("id, event_id, mentor_id, max_bookings, start_time, end_time")
      .eq("id", availability_id)
      .single();

    if (slotErr || !slot) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }
    if (slot.event_id !== eventId) {
      return NextResponse.json({ error: "Event mismatch" }, { status: 400 });
    }
    if (slot.mentor_id === user.id) {
      return NextResponse.json(
        { error: "Mentors cannot book their own slot" },
        { status: 400 }
      );
    }

    // Duplicate check.
    const { data: existing } = await service
      .from("mentor_bookings")
      .select("id, status")
      .eq("availability_id", availability_id)
      .eq("participant_id", user.id)
      .maybeSingle();

    if (existing && existing.status === BookingStatus.Confirmed) {
      return NextResponse.json(
        { error: "You already booked this slot" },
        { status: 409 }
      );
    }

    // Capacity check.
    const { count: activeCount, error: countErr } = await service
      .from("mentor_bookings")
      .select("*", { count: "exact", head: true })
      .eq("availability_id", availability_id)
      .eq("status", BookingStatus.Confirmed);

    if (countErr) {
      console.error("capacity count error", countErr);
      return NextResponse.json(
        { error: "Failed to verify capacity" },
        { status: 500 }
      );
    }

    if ((activeCount ?? 0) >= slot.max_bookings) {
      return NextResponse.json(
        { error: "Slot is fully booked" },
        { status: 409 }
      );
    }

    // If there's a cancelled row, flip it; otherwise insert.
    let booking;
    if (existing) {
      const { data, error } = await service
        .from("mentor_bookings")
        .update({ status: BookingStatus.Confirmed, booked_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) {
        console.error("booking reactivate error", error);
        return NextResponse.json(
          { error: "Failed to book slot" },
          { status: 500 }
        );
      }
      booking = data;
    } else {
      const { data, error } = await supabase
        .from("mentor_bookings")
        .insert({
          availability_id,
          participant_id: user.id,
          status: BookingStatus.Confirmed,
        })
        .select()
        .single();
      if (error) {
        // Unique-violation race safety.
        if ((error as { code?: string }).code === "23505") {
          return NextResponse.json(
            { error: "You already booked this slot" },
            { status: 409 }
          );
        }
        console.error("booking insert error", error);
        return NextResponse.json(
          { error: "Failed to book slot" },
          { status: 500 }
        );
      }
      booking = data;
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

// DELETE — cancel own booking (or organizer/admin override).
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
      .select("event_id")
      .eq("id", booking.availability_id)
      .single();

    if (!slot || slot.event_id !== eventId) {
      return NextResponse.json({ error: "Event mismatch" }, { status: 400 });
    }

    const isOwner = booking.participant_id === user.id;
    const canModerate =
      role === EventRole.Organizer || role === EventRole.Admin;
    if (!isOwner && !canModerate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: delErr } = await supabase
      .from("mentor_bookings")
      .delete()
      .eq("id", id);

    if (delErr) {
      console.error("booking delete error", delErr);
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
