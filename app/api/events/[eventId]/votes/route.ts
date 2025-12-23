import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";

const MAX_VOTES_PER_USER = 3;

// GET: Get vote counts for all projects in an event + user's votes
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { eventId } = await params;

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Get all votes for this event grouped by project
    const { data: votes, error: votesError } = await supabase
      .from("project_votes")
      .select("project_id, user_id")
      .eq("event_id", eventId);

    if (votesError) {
      console.error("Error fetching votes:", votesError);
      return NextResponse.json({ error: "Failed to fetch votes" }, { status: 500 });
    }

    // Count votes per project
    const voteCounts: Record<string, number> = {};
    const userVotes: string[] = [];

    for (const vote of votes || []) {
      voteCounts[vote.project_id] = (voteCounts[vote.project_id] || 0) + 1;
      if (user && vote.user_id === user.id) {
        userVotes.push(vote.project_id);
      }
    }

    return NextResponse.json({
      voteCounts,
      userVotes,
      remainingVotes: user ? MAX_VOTES_PER_USER - userVotes.length : 0,
      maxVotes: MAX_VOTES_PER_USER,
    });
  } catch (error) {
    console.error("GET /events/[eventId]/votes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Cast a vote for a project
export async function POST(
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

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    // Check if project belongs to this event
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, event_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.event_id !== eventId) {
      return NextResponse.json({ error: "Project does not belong to this event" }, { status: 400 });
    }

    // Check user's current vote count for this event
    const { count: currentVoteCount, error: countError } = await supabase
      .from("project_votes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event_id", eventId);

    if (countError) {
      console.error("Error counting votes:", countError);
      return NextResponse.json({ error: "Failed to check vote count" }, { status: 500 });
    }

    if ((currentVoteCount || 0) >= MAX_VOTES_PER_USER) {
      return NextResponse.json(
        { error: `You can only vote for ${MAX_VOTES_PER_USER} projects per event` },
        { status: 400 }
      );
    }

    // Insert the vote
    const { error: insertError } = await supabase
      .from("project_votes")
      .insert({
        project_id: projectId,
        user_id: user.id,
        event_id: eventId,
      });

    if (insertError) {
      if (insertError.message.includes("duplicate key") || insertError.code === "23505") {
        return NextResponse.json({ error: "You have already voted for this project" }, { status: 400 });
      }
      console.error("Error inserting vote:", insertError);
      return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
    }

    return NextResponse.json({ success: true, remainingVotes: MAX_VOTES_PER_USER - (currentVoteCount || 0) - 1 });
  } catch (error) {
    console.error("POST /events/[eventId]/votes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Remove a vote from a project
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

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    // Delete the vote
    const { error: deleteError } = await supabase
      .from("project_votes")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("event_id", eventId);

    if (deleteError) {
      console.error("Error deleting vote:", deleteError);
      return NextResponse.json({ error: "Failed to remove vote" }, { status: 500 });
    }

    // Get updated vote count
    const { count: currentVoteCount } = await supabase
      .from("project_votes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event_id", eventId);

    return NextResponse.json({ success: true, remainingVotes: MAX_VOTES_PER_USER - (currentVoteCount || 0) });
  } catch (error) {
    console.error("DELETE /events/[eventId]/votes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
