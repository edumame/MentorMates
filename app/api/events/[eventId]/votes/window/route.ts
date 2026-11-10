import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import {
  validateVotingWindow,
  type VotingWindow,
} from "@/features/voting/utils/voting-window";

function parseBound(value: unknown): string | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value === "string") return value;
  return undefined;
}

// PATCH: set or clear the popular-vote window (organizers/owner only).
// Body: { opensAt: ISO string | null, closesAt: ISO string | null }
export async function PATCH(
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

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const opensAt = parseBound(body?.opensAt);
    const closesAt = parseBound(body?.closesAt);
    if (opensAt === undefined || closesAt === undefined) {
      return NextResponse.json(
        { error: "opensAt and closesAt must be ISO date strings or null" },
        { status: 400 }
      );
    }

    const invalid = validateVotingWindow({ opensAt, closesAt });
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }
    // Validated above, so both parse; store as UTC instants (timestamptz).
    const window: VotingWindow = {
      opensAt: opensAt === null ? null : new Date(opensAt).toISOString(),
      closesAt: closesAt === null ? null : new Date(closesAt).toISOString(),
    };

    const { data: isOrganizer, error: roleError } = await supabase.rpc(
      "is_event_organizer_or_owner",
      { p_event_id: eventId, p_user_id: user.id }
    );
    if (roleError) {
      console.error("Error verifying organizer for voting window:", roleError);
      return NextResponse.json(
        { error: "Failed to verify permissions" },
        { status: 500 }
      );
    }
    if (!isOrganizer) {
      return NextResponse.json(
        { error: "Only organizers can change the voting window" },
        { status: 403 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("events")
      .update({
        voting_opens_at: window.opensAt,
        voting_closes_at: window.closesAt,
      })
      .eq("event_id", eventId)
      .select("voting_opens_at, voting_closes_at")
      .maybeSingle();

    if (updateError) {
      console.error("Error updating voting window:", updateError);
      return NextResponse.json(
        { error: "Failed to update voting window" },
        { status: 500 }
      );
    }
    if (!updated) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      votingOpensAt: updated.voting_opens_at,
      votingClosesAt: updated.voting_closes_at,
    });
  } catch (error) {
    console.error("PATCH /events/[eventId]/votes/window error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
