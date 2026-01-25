import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole, ParticipantRequestStatus } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";

const createRequestSchema = z.object({
  role: z
    .enum([
      EventRole.Participant,
      EventRole.Mentor,
      EventRole.Judge,
    ])
    .default(EventRole.Participant),
  reason: z.string().max(2000).optional(),
});

const listRequestsSchema = z.object({
  status: z
    .enum([
      ParticipantRequestStatus.Pending,
      ParticipantRequestStatus.Approved,
      ParticipantRequestStatus.Rejected,
      ParticipantRequestStatus.Withdrawn,
    ])
    .optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// GET: List approval requests for an event (organizers only)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const supabase = await createSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is organizer/admin for this event
    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: isAdminRpc } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });
    const isAdmin = Boolean(isAdminRpc);

    const isOrganizer =
      roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Organizer);

    if (!isOrganizer && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const parsed = listRequestsSchema.safeParse({
      status: searchParams.get("status"),
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { status, limit, offset } = parsed.data;

    // Build query
    let query = supabase
      .from("participant_approval_requests")
      .select(
        `
        *,
        user_profile:user_profiles!participant_approval_requests_user_id_fkey(
          uid,
          display_name,
          email,
          avatar_url
        ),
        reviewer_profile:user_profiles!participant_approval_requests_reviewed_by_fkey(
          uid,
          display_name
        )
      `,
        { count: "exact" }
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: requests, error: queryError, count } = await query;

    if (queryError) {
      console.error("Error fetching approval requests:", queryError);
      return NextResponse.json(
        { error: "Failed to fetch requests" },
        { status: 500 }
      );
    }

    // Get count of pending requests
    const { count: pendingCount } = await supabase
      .from("participant_approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "pending");

    return NextResponse.json({
      requests,
      total: count,
      pending_count: pendingCount || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error in approval requests GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Create a new approval request (authenticated users)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const supabase = await createSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const parsed = createRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { role, reason } = parsed.data;

    // Check if event exists and requires approval
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("event_id, event_name, require_participant_approval, participant_capacity")
      .eq("event_id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Check if user already has a role in this event
    const { data: existingRole } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingRole) {
      return NextResponse.json(
        { error: "You already have a role in this event" },
        { status: 409 }
      );
    }

    // Check if user already has a pending request for this role
    const { data: existingRequest } = await supabase
      .from("participant_approval_requests")
      .select("id, status")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .eq("requested_role", role)
      .in("status", ["pending"])
      .maybeSingle();

    if (existingRequest) {
      return NextResponse.json(
        { error: "You already have a pending request for this event" },
        { status: 409 }
      );
    }

    // Check participant capacity (only for participant role)
    if (role === EventRole.Participant && event.participant_capacity) {
      const { count: participantCount } = await supabase
        .from("user_event_roles")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("role", "participant");

      if (participantCount && participantCount >= event.participant_capacity) {
        return NextResponse.json(
          { error: "Event is at full capacity" },
          { status: 409 }
        );
      }
    }

    // Create the approval request
    const { data: newRequest, error: insertError } = await supabase
      .from("participant_approval_requests")
      .insert({
        event_id: eventId,
        user_id: user.id,
        requested_role: role,
        reason: reason || null,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating approval request:", insertError);
      return NextResponse.json(
        { error: "Failed to create request" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        request: newRequest,
        message: "Your request has been submitted and is pending approval",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in approval requests POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
