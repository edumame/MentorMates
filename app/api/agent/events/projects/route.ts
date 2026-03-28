import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest, requireScope } from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// GET: List all projects for the event
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "projects:read");
    if (scopeError) return scopeError;

    const supabase = createSupabaseServiceClient();
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || "50"),
      200
    );
    const offset = parseInt(
      request.nextUrl.searchParams.get("offset") || "0"
    );
    const submitted = request.nextUrl.searchParams.get("submitted");

    let query = supabase
      .from("projects")
      .select("*", { count: "exact" })
      .eq("event_id", auth.eventId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (submitted === "true") {
      query = query.eq("submitted", true);
    } else if (submitted === "false") {
      query = query.eq("submitted", false);
    }

    const { data: projects, error, count } = await query;

    if (error) {
      console.error("Error fetching projects:", error);
      return NextResponse.json(
        { error: "Failed to fetch projects" },
        { status: 500 }
      );
    }

    // Get scores for all projects
    const projectIds = projects?.map((p) => p.id) || [];
    let scores: Record<string, unknown>[] = [];

    if (projectIds.length > 0) {
      const { data: scoreData } = await supabase
        .from("project_scores")
        .select("project_id, scores, comments, judge_id, finalist_recommendation")
        .in("project_id", projectIds);

      scores = scoreData || [];
    }

    // Attach scores to projects
    const projectsWithScores = projects?.map((project) => ({
      ...project,
      scores: scores.filter(
        (s) => (s as { project_id: string }).project_id === project.id
      ),
    }));

    return NextResponse.json({
      projects: projectsWithScores,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Agent projects GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
