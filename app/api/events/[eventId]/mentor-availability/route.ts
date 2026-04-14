import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import type {
  MentorAvailability,
  MentorAvailabilityWithBookings,
  MentorProfileLite,
} from "@/lib/types/mentor-booking";
import { BookingStatus } from "@/lib/types/mentor-booking";

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
            .select("uid, display_name, email, avatar_url")
            .in("uid", mentorIds)
        : Promise.resolve({ data: [], error: null } as {
            data: MentorProfileLite[];
            error: null;
          }),
    ]);

    if (bookingRes.error) {
      console.error("mentor_bookings count error", bookingRes.error);
    }
    if (mentorRes.error) {
      console.error("mentor profiles fetch error", mentorRes.error);
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

// DELETE — mentor removes a slot (cascades bookings).
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

    const { error: delErr } = await supabase
      .from("mentor_availability")
      .delete()
      .eq("id", id);

    if (delErr) {
      console.error("mentor_availability delete error", delErr);
      return NextResponse.json(
        { error: "Failed to delete availability" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("mentor-availability DELETE error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
