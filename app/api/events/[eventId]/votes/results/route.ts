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

    // Get all votes with project details
    const { data: votes, error: votesError } = await supabase
      .from("project_votes")
      .select(`
        id,
        project_id,
        user_id,
        created_at,
        projects!inner (
          id,
          project_name,
          lead_name,
          cover_image_url
        )
      `)
      .eq("event_id", eventId);

    if (votesError) {
      console.error("Error fetching votes:", votesError);
      return NextResponse.json({ error: "Failed to fetch voting results" }, { status: 500 });
    }

    // Aggregate results
    const projectVotes: Record<string, {
      projectId: string;
      projectName: string;
      leadName: string;
      coverImageUrl: string | null;
      voteCount: number;
      voters: string[];
    }> = {};

    for (const vote of votes || []) {
      const project = vote.projects as unknown as {
        id: string;
        project_name: string;
        lead_name: string;
        cover_image_url: string | null;
      };
      
      if (!projectVotes[vote.project_id]) {
        projectVotes[vote.project_id] = {
          projectId: project.id,
          projectName: project.project_name || "Untitled Project",
          leadName: project.lead_name || "Unknown",
          coverImageUrl: project.cover_image_url,
          voteCount: 0,
          voters: [],
        };
      }
      projectVotes[vote.project_id].voteCount++;
      projectVotes[vote.project_id].voters.push(vote.user_id);
    }

    // Convert to array and sort by vote count
    const results = Object.values(projectVotes).sort((a, b) => b.voteCount - a.voteCount);

    // Get total unique voters
    const uniqueVoters = new Set((votes || []).map(v => v.user_id));

    return NextResponse.json({
      results,
      totalVotes: votes?.length || 0,
      totalVoters: uniqueVoters.size,
      eventId,
    });
  } catch (error) {
    console.error("GET /events/[eventId]/votes/results error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
