import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";

// GET: Get detailed voting results (organizer only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { eventId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    // Check if user is an organizer for this event
    const { data: userRole, error: roleError } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (roleError) {
      console.error("Error checking user role:", roleError);
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
    }

    // Also check if user is event owner
    const { data: event } = await supabase
      .from("events")
      .select("owner_id")
      .eq("event_id", eventId)
      .single();

    const isOrganizer = userRole?.role === "organizer" || event?.owner_id === user.id;

    if (!isOrganizer) {
      return NextResponse.json({ error: "Only organizers can view voting results" }, { status: 403 });
    }

    const { data: results, error } = await supabase.rpc("project_vote_results", { p_event_id: eventId });
    if (error) return NextResponse.json({ error: "Failed to fetch voting results" }, { status: 500 });
    return NextResponse.json(results);
  } catch (error) {
    console.error("GET /events/[eventId]/votes/results error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: void a fraudulent vote (organizers/owner only; audited in project_vote_voids).
// Body: { projectId: string, voterId: string, reason?: string }
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { eventId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
    const voterId = typeof body?.voterId === "string" ? body.voterId.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : null;
    if (!eventId || !projectId || !voterId) {
      return NextResponse.json(
        { error: "projectId and voterId are required" },
        { status: 400 }
      );
    }

    // void_project_vote checks organizer/owner itself and writes the audit row.
    const { data: voided, error } = await supabase.rpc("void_project_vote", {
      p_event_id: eventId,
      p_project_id: projectId,
      p_voter_id: voterId,
      p_reason: reason,
    });
    if (error) {
      if (error.code === "42501") {
        return NextResponse.json({ error: "Only organizers can void votes" }, { status: 403 });
      }
      if (error.code === "22P02") {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }
      console.error("Error voiding vote:", error);
      return NextResponse.json({ error: "Failed to void vote" }, { status: 500 });
    }
    if (!voided) {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, voided });
  } catch (error) {
    console.error("DELETE /events/[eventId]/votes/results error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
