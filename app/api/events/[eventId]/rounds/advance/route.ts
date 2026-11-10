import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { canAccessRole } from "@/features/user/roles/roles";
import { EventRole, type EventScoringConfig, type EventTrack } from "@/lib/types";
import { buildEventScoringConfig } from "@/lib/events/build-event-scoring-config";
import {
  filterScoresToCurrentProjectTracks,
  getProjectIdsForRound,
  replaceAdvancements,
} from "@/lib/judging/rounds";
import { rankProjectsForAdvancement } from "@/lib/judging/advancement-ranking";

const bodySchema = z.object({
  fromRound: z.number().int().positive(),
  projectIds: z.array(z.string().uuid()).default([]),
});

async function authorizeOrganizer(
  params: Promise<{ eventId: string }>
) {
  const supabase = await createSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { eventId } = await params;
  if (!eventId) {
    return {
      errorResponse: NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      ),
    };
  }

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
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { supabase, eventId };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await authorizeOrganizer(params);
    if ("errorResponse" in auth) return auth.errorResponse;

    const { supabase, eventId } = auth;
    const fromRound = Number(request.nextUrl.searchParams.get("fromRound"));
    if (!Number.isInteger(fromRound) || fromRound <= 0) {
      return NextResponse.json({ error: "Invalid fromRound" }, { status: 400 });
    }

    const toRound = fromRound + 1;
    const eligibleProjectIds = await getProjectIdsForRound(
      supabase,
      eventId,
      fromRound
    );
    const eligibleProjectIdSet = new Set(eligibleProjectIds);

    const { data: advancedRows, error: advancedErr } = await supabase
      .from("project_round_advancements")
      .select("project_id")
      .eq("event_id", eventId)
      .eq("round_number", toRound);
    if (advancedErr) throw advancedErr;

    const [scoreResult, tracksResult, eventResult, scorerRolesResult] = await Promise.all([
      supabase
        .from("project_scores")
        .select(
          `
          project_id,
          judge_id,
          track_id,
          scores,
          projects:projects!inner (
            project_name,
            lead_name,
            event_id
          ),
          event_tracks:event_tracks!fk_project_scores_track (
            name
          )
        `
        )
        .eq("event_id", eventId)
        .eq("round_number", fromRound),
      supabase
        .from("event_tracks")
        .select("track_id, name, scoring_criteria")
        .eq("event_id", eventId),
      supabase
        .from("events")
        .select("scoring_config")
        .eq("event_id", eventId)
        .maybeSingle(),
      // Current scorers (JUDGE-017): rows from former judges are not ranked,
      // matching the organizer leaderboard and CSV export.
      supabase
        .from("user_event_roles")
        .select("user_id")
        .eq("event_id", eventId)
        .in("role", ["judge", "organizer", "admin"]),
    ]);
    if (scoreResult.error) throw scoreResult.error;
    if (tracksResult.error) throw tracksResult.error;
    if (eventResult.error) throw eventResult.error;

    let activeJudgeIds: Set<string> | null = null;
    if (scorerRolesResult.error) {
      // Same fallback as the leaderboard: count every score rather than hide valid ones.
      console.error("Error fetching current judges:", scorerRolesResult.error);
    } else {
      activeJudgeIds = new Set(
        (scorerRolesResult.data ?? []).map((row) => String(row.user_id))
      );
    }

    const scoringConfig = buildEventScoringConfig({
      event_tracks: (tracksResult.data ?? []) as EventTrack[],
      scoring_config:
        (eventResult.data?.scoring_config as EventScoringConfig | null) ?? null,
    });

    type Joined<T> = T | T[] | null;
    const first = <T,>(value: Joined<T>): T | null =>
      Array.isArray(value) ? value[0] ?? null : value;

    let currentProjectTracks: Array<{ project_id: string; track_id: string }> = [];
    if (eligibleProjectIds.length > 0) {
      const { data, error: projectTracksErr } = await supabase
        .from("project_tracks")
        .select("project_id, track_id")
        .in("project_id", eligibleProjectIds);
      if (projectTracksErr) throw projectTracksErr;
      currentProjectTracks = data ?? [];
    }

    const rankedProjects = rankProjectsForAdvancement(
      filterScoresToCurrentProjectTracks(
        (scoreResult.data ?? []) as Array<{
        project_id: string;
        judge_id: string | null;
        track_id: string | null;
        scores: Record<string, unknown> | null;
        projects: Joined<{
          project_name?: string | null;
          lead_name?: string | null;
          event_id?: string | null;
        }>;
        event_tracks: Joined<{ name?: string | null }>;
      }>,
        // A track the project has left must not affect its rank.
        currentProjectTracks
      )
        // Rank eligible projects only, so competition ranks have no gaps.
        .filter((row) => eligibleProjectIdSet.has(row.project_id))
        .map((row) => {
          const project = first(row.projects);
          return {
            project_id: row.project_id,
            judge_id: row.judge_id,
            track_id: row.track_id,
            track_name: first(row.event_tracks)?.name ?? "",
            scores: row.scores,
            project_name: project?.project_name ?? "",
            lead_name: project?.lead_name ?? "",
          };
        }),
      { scoringConfig, roundNumber: fromRound, activeJudgeIds }
    );

    const rankedIds = new Set(rankedProjects.map((project) => project.projectId));
    let eligibleProjects: Array<{
      id: string;
      project_name: string | null;
      lead_name: string | null;
    }> = [];

    if (eligibleProjectIds.length > 0) {
      const { data, error: eligibleErr } = await supabase
        .from("projects")
        .select("id, project_name, lead_name")
        .eq("event_id", eventId)
        .in("id", eligibleProjectIds);
      if (eligibleErr) throw eligibleErr;
      eligibleProjects = (data ?? []) as Array<{
        id: string;
        project_name: string | null;
        lead_name: string | null;
      }>;
    }

    const candidates = [
      // rank is the competition rank from rankProjectsForAdvancement (ties share a rank).
      ...rankedProjects,
      ...eligibleProjects
        .filter((project) => !rankedIds.has(project.id))
        .sort((a, b) =>
          (a.project_name ?? "").localeCompare(b.project_name ?? "")
        )
        .map((project) => ({
          rank: null,
          projectId: project.id,
          projectName: project.project_name ?? "",
          leadName: project.lead_name ?? "",
          score: null,
          judgeCount: 0,
        })),
    ];

    return NextResponse.json({
      success: true,
      fromRound,
      toRound,
      candidates,
      selectedProjectIds: (advancedRows ?? []).map((row) => row.project_id),
    });
  } catch (error) {
    console.error("Error loading round advancement candidates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await authorizeOrganizer(params);
    if ("errorResponse" in auth) return auth.errorResponse;

    const { supabase, eventId } = auth;
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { fromRound, projectIds } = parsed.data;
    const eligibleProjectIds = new Set(
      await getProjectIdsForRound(supabase, eventId, fromRound)
    );
    const invalidProjectIds = projectIds.filter(
      (projectId) => !eligibleProjectIds.has(projectId)
    );

    if (invalidProjectIds.length > 0) {
      return NextResponse.json(
        {
          error: "Some selected projects are not eligible for this round",
          invalidProjectIds,
        },
        { status: 400 }
      );
    }

    const result = await replaceAdvancements(
      supabase,
      eventId,
      fromRound,
      projectIds
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
