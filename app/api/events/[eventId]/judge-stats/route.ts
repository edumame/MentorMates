import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";

/**
 * GET /api/events/[eventId]/judge-stats
 *
 * Returns the data an organizer needs to generate evidence letters for
 * judges and mentors (e.g. for an O1 visa packet):
 *   - attendance: total participants registered for the event
 *   - eventName / eventDate: pulled from the events row
 *   - judges:  per-judge stats with distinct projects scored
 *   - mentors: per-mentor stats with distinct projects given feedback
 *
 * Organizer/admin only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const serviceSupabase = createSupabaseServiceClient();
    const { eventId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const { data: eventRow, error: eventError } = await serviceSupabase
      .from("events")
      .select("event_id, event_name, event_date, location")
      .eq("event_id", eventId)
      .single();

    if (eventError || !eventRow) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const { count: participantCount } = await serviceSupabase
      .from("user_event_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("role", EventRole.Participant);

    const { data: roleRows, error: rolesError } = await serviceSupabase
      .from("user_event_roles")
      .select(
        `
        user_id,
        role,
        user_profiles:user_id (
          uid,
          display_name,
          email,
          affiliation
        )
      `
      )
      .eq("event_id", eventId)
      .in("role", [EventRole.Judge, EventRole.Mentor])
      .order("created_at", { ascending: true });

    if (rolesError) {
      return NextResponse.json(
        { error: "Failed to fetch judges and mentors" },
        { status: 500 }
      );
    }

    const judgeRows = (roleRows || []).filter(
      (r) => r.role === EventRole.Judge
    );
    const mentorRows = (roleRows || []).filter(
      (r) => r.role === EventRole.Mentor
    );

    const judgeIds = judgeRows.map((row) => row.user_id);
    const mentorIds = mentorRows.map((row) => row.user_id);

    const scoresByJudge = new Map<string, Set<string>>();
    if (judgeIds.length > 0) {
      const { data: scoreRows } = await serviceSupabase
        .from("project_scores")
        .select("judge_id, project_id")
        .eq("event_id", eventId)
        .in("judge_id", judgeIds);

      (scoreRows || []).forEach((row) => {
        if (!row.judge_id || !row.project_id) return;
        const set = scoresByJudge.get(row.judge_id) ?? new Set<string>();
        set.add(row.project_id);
        scoresByJudge.set(row.judge_id, set);
      });
    }

    const feedbackByMentor = new Map<string, Set<string>>();
    if (mentorIds.length > 0) {
      const { data: feedbackRows } = await serviceSupabase
        .from("feedback")
        .select("mentor_id, project_id")
        .eq("event_id", eventId)
        .in("mentor_id", mentorIds);

      (feedbackRows || []).forEach((row) => {
        if (!row.mentor_id || !row.project_id) return;
        const set = feedbackByMentor.get(row.mentor_id) ?? new Set<string>();
        set.add(row.project_id);
        feedbackByMentor.set(row.mentor_id, set);
      });
    }

    const mapRole = (
      rows: typeof judgeRows,
      counts: Map<string, Set<string>>,
      countKey: "projects_judged" | "projects_mentored"
    ) =>
      rows.map((row) => {
        const profile = Array.isArray(row.user_profiles)
          ? row.user_profiles[0]
          : row.user_profiles;
        return {
          user_id: row.user_id,
          display_name: profile?.display_name ?? "",
          email: profile?.email ?? "",
          affiliation: profile?.affiliation ?? "",
          [countKey]: counts.get(row.user_id)?.size ?? 0,
        };
      });

    const judges = mapRole(judgeRows, scoresByJudge, "projects_judged");
    const mentors = mapRole(mentorRows, feedbackByMentor, "projects_mentored");

    return NextResponse.json({
      event: {
        event_id: eventRow.event_id,
        event_name: eventRow.event_name,
        event_date: eventRow.event_date,
        location: eventRow.location,
      },
      attendance: participantCount ?? 0,
      judges,
      mentors,
    });
  } catch (error) {
    console.error("Error in GET /api/events/[eventId]/judge-stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
