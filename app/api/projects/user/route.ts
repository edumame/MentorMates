import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { Prize } from "@/lib/types";

export async function GET() {
  try {
    const supabase = await createSupabaseClient();


    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 }
      );
    }

    // Get projects where user is lead
    const { data: leadProjects, error: leadError } = await supabase
      .from("projects")
      .select(
        `
        *,
        project_tracks (
          event_tracks (
            track_id,
            name
          )
        )`
      )
      .eq("lead_email", user.email);

    if (leadError) {
      console.error("Error fetching lead projects:", leadError);
      return NextResponse.json(
        { error: "Failed to fetch lead projects" },
        { status: 500 }
      );
    }

    // Get projects where user is teammate
    const { data: teamProjects, error: teamError } = await supabase
      .from("projects")
      .select(
        `
        *,
        project_tracks (
          event_tracks (
            track_id,
            name
          )
        )`
      )
      .contains("teammates", [user.email]);

    if (teamError) {
      console.error("Error fetching team projects:", teamError);
      return NextResponse.json(
        { error: "Failed to fetch team projects" },
        { status: 500 }
      );
    }

    // Combine and deduplicate
    const allProjects = [
      ...(leadProjects || []),
      ...(teamProjects || []),
    ].filter(
      (proj, idx, arr) => idx === arr.findIndex((p) => p.id === proj.id)
    );

    // Fetch prizes and winners for all projects
    if (allProjects.length > 0) {
      const projectIds = allProjects.map((p) => p.id);
      const { data: prizesData, error: prizesError } = await supabase
        .from("prizes")
        .select(
          `
          id,
          track_id,
          prize_amount,
          prize_description,
          prize_winners!inner (
            id,
            project_id,
            assigned_at,
            assigned_by,
            projects!inner (
              id,
              project_name,
              lead_name
            )
          )
        `
        )
        .in("prize_winners.project_id", projectIds);

      if (prizesError) {
        console.error("Error fetching prizes:", prizesError);
        return NextResponse.json(
          { error: "Failed to fetch prizes" },
          { status: 500 }
        );
      }

      // Group prizes by project_id
      const prizesByProject = (prizesData || []).reduce(
        (acc, prize) => {
          prize.prize_winners.forEach((winner) => {
            const projectId = winner.project_id;
            if (!acc[projectId]) acc[projectId] = [];
            acc[projectId].push({
              ...prize,
            });
          });
          return acc;
        },
        {} as Record<string, Prize[]>
      );

      // Add prizes to projects
      allProjects.forEach((project) => {
        project.prizes_won = prizesByProject[project.id] || [];
      });
    }

    return NextResponse.json({ projects: allProjects });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
