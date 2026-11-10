import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getPopularVotePermission } from "@/features/voting/utils/voting-permissions";
import { getVotingWindowState } from "@/features/voting/utils/voting-window";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_VOTES_PER_USER = 3;

interface VoteSummary {
  voteCounts?: Record<string, number>;
  userVotes?: string[];
  ownProjectIds?: string[];
  votingOpensAt?: string | null;
  votingClosesAt?: string | null;
}

async function readProjectId(request: NextRequest): Promise<string | null> {
  try {
    const body = await request.json();
    return typeof body?.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : null;
  } catch {
    return null;
  }
}

// Maps vote RPC errors (cast_project_vote / remove_project_vote) to HTTP.
function voteErrorResponse(
  error: { code?: string; message?: string },
  fallback: string
) {
  const status =
    error.code === "42501"
      ? 403
      : error.code === "P0002"
        ? 404
        : ["23514", "22023", "22P02"].includes(error.code ?? "")
          ? 400
          : 500;
  return NextResponse.json(
    { error: status === 500 ? fallback : error.message || fallback },
    { status }
  );
}

async function getUserRoleForEvent(
  supabase: SupabaseClient,
  userId: string,
  eventId: string
) {
  const { data, error } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    return { role: null, error };
  }

  return { role: data?.role ?? null, error: null };
}

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

    let userRole: string | null = null;
    if (user) {
      const { role, error: roleError } = await getUserRoleForEvent(
        supabase,
        user.id,
        eventId
      );
      if (roleError) {
        console.error("Error fetching user role:", roleError);
        return NextResponse.json(
          { error: "Failed to verify voting permissions" },
          { status: 500 }
        );
      }
      userRole = role;
    }

    const permission = getPopularVotePermission(userRole);

    // project_vote_summary only returns live totals (voteCounts) to organizers/owner;
    // everyone else gets their own ballot only (JUDGE-002).
    const { data, error: votesError } = await supabase.rpc("project_vote_summary", { p_event_id: eventId });
    if (votesError) return NextResponse.json({ error: "Failed to fetch votes" }, { status: 500 });
    const summary = (data ?? {}) as VoteSummary;
    const voteCounts: Record<string, number> = summary.voteCounts ?? {};
    const userVotes: string[] = summary.userVotes ?? [];
    const votingOpensAt = summary.votingOpensAt ?? null;
    const votingClosesAt = summary.votingClosesAt ?? null;
    const windowState = getVotingWindowState({ opensAt: votingOpensAt, closesAt: votingClosesAt });
    const canVote = Boolean(user) && permission.canVote && windowState.status === "open";

    return NextResponse.json({
      voteCounts,
      userVotes,
      ownProjectIds: summary.ownProjectIds ?? [],
      remainingVotes: canVote
        ? Math.max(0, MAX_VOTES_PER_USER - userVotes.length)
        : 0,
      maxVotes: MAX_VOTES_PER_USER,
      canVote,
      blockedReason:
        permission.blockedReason ??
        (windowState.status === "open" ? null : windowState.message),
      votingOpensAt,
      votingClosesAt,
      votingStatus: windowState.status,
      userRole,
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

    const { role: userRole, error: roleError } = await getUserRoleForEvent(
      supabase,
      user.id,
      eventId
    );
    if (roleError) {
      console.error("Error fetching user role:", roleError);
      return NextResponse.json(
        { error: "Failed to verify voting permissions" },
        { status: 500 }
      );
    }

    const permission = getPopularVotePermission(userRole);
    if (!permission.canVote) {
      return NextResponse.json(
        { error: permission.blockedReason || "You cannot vote in this event" },
        { status: 403 }
      );
    }

    const projectId = await readProjectId(request);
    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    // cast_project_vote enforces eligibility, own-project, submitted/public project,
    // the voting window and the per-user cap atomically.
    const { data: remainingVotes, error: voteError } = await supabase.rpc("cast_project_vote", {
      p_event_id: eventId, p_project_id: projectId,
    });
    if (voteError) return voteErrorResponse(voteError, "Failed to cast vote");
    return NextResponse.json({ success: true, remainingVotes });
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

    // No role check: anyone may withdraw their own ballot (e.g. a voter whose role
    // later changed). remove_project_vote only touches the caller's own row and
    // enforces the voting window.
    const projectId = await readProjectId(request);
    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const { data: remainingVotes, error: removeError } = await supabase.rpc("remove_project_vote", {
      p_event_id: eventId, p_project_id: projectId,
    });
    if (removeError) return voteErrorResponse(removeError, "Failed to remove vote");
    return NextResponse.json({ success: true, remainingVotes });
  } catch (error) {
    console.error("DELETE /events/[eventId]/votes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
