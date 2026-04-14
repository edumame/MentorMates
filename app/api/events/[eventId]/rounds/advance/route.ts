import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { canAccessRole } from "@/features/user/roles/roles";
import { EventRole, type EventScoringConfig } from "@/lib/types";
import { computeAdvancements } from "@/lib/judging/rounds";

const bodySchema = z.object({
  fromRound: z.number().int().positive(),
});

/**
 * POST /api/events/[eventId]/rounds/advance
 *
 * Body: { fromRound: number }
 *
 * Organizer-only. Computes top-K advancements from `fromRound` based on the
 * event's `scoring_config.rounds[fromRound].advancement_count`, and inserts
 * rows into `project_round_advancements` for `fromRound + 1`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;
    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { fromRound } = parsed.data;

    // Authorize: organizer of this event OR admin.
    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    let isAllowed = false;
    if (
      roleRow &&
      canAccessRole(roleRow.role as EventRole, EventRole.Organizer)
    ) {
      isAllowed = true;
    } else {
      const { data: isAdmin } = await supabase.rpc("is_admin_user", {
        user_id: user.id,
      });
      isAllowed = Boolean(isAdmin);
    }

    if (!isAllowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("event_id, scoring_config")
      .eq("event_id", eventId)
      .maybeSingle();
    if (eventErr || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const scoringConfig =
      (event.scoring_config as EventScoringConfig | null) ?? null;

    const result = await computeAdvancements(
      supabase,
      eventId,
      fromRound,
      scoringConfig
    );

    return NextResponse.json({
      success: true,
      fromRound,
      toRound: result.toRound,
      advancedCount: result.advanced.length,
      advanced: result.advanced,
    });
  } catch (error) {
    console.error("Error advancing round:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
