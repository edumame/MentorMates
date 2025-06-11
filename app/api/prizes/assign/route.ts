import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { prizeId, projectId } = await request.json();

    if (!prizeId) {
      return NextResponse.json(
        { error: "Prize ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get prize details to find the track and event
    const { data: prize, error: prizeError } = await supabase
      .from("prizes")
      .select(`
        id,
        track_id,
        event_tracks!inner(event_id)
      `)
      .eq("id", prizeId)
      .single();

    if (prizeError || !prize) {
      return NextResponse.json(
        { error: "Prize not found" },
        { status: 404 }
      );
    }

    const eventId = (prize.event_tracks as unknown as { event_id: string }[])[0]?.event_id;

    // Check if current user is an organizer of this event
    const { data: currentUserRole, error: roleError } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single();

    if (roleError || !currentUserRole || currentUserRole.role !== EventRole.Organizer) {
      return NextResponse.json(
        { error: "Insufficient permissions. Must be an organizer." },
        { status: 403 }
      );
    }

    // If projectId is null, we're unassigning the prize
    if (projectId === null) {
      const { error: updateError } = await supabase
        .from("prizes")
        .update({
          winning_project_id: null,
          assigned_by: null,
          assigned_at: null,
        })
        .eq("id", prizeId);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to unassign prize" },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        success: true, 
        message: "Prize unassigned successfully" 
      });
    }

    // Validate project exists and is in the correct event
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, event_id")
      .eq("id", projectId)
      .eq("event_id", eventId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found or not in this event" },
        { status: 404 }
      );
    }

    // Assign the prize
    const { error: updateError } = await supabase
      .from("prizes")
      .update({
        winning_project_id: projectId,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", prizeId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to assign prize" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: "Prize assigned successfully" 
    });

  } catch (error) {
    console.error("Error assigning prize:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}