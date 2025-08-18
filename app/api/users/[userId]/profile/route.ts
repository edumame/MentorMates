import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("display_name, email, links")
      .eq("uid", userId)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    // Fetch projects where user is lead
    const { data: leadProjects, error: leadError } = await supabase
      .from("projects")
      .select(
        `
        id,
        project_name,
        project_description,
        lead_name,
        lead_email,
        teammates,
        project_url,
        cover_image_url,
        event_id,
        created_at,
        project_tracks (
          event_tracks (
            track_id,
            name
          )
        )
      `
      )
      .eq("lead_email", profile.email);

    if (leadError) {
      console.error("Error fetching lead projects:", leadError);
      return NextResponse.json(
        { error: "Failed to fetch lead projects" },
        { status: 500 }
      );
    }

    // Fetch projects where user is teammate
    const { data: teamProjects, error: teamError } = await supabase
      .from("projects")
      .select(
        `
        id,
        project_name,
        project_description,
        lead_name,
        lead_email,
        teammates,
        project_url,
        cover_image_url,
        event_id,
        created_at,
        project_tracks (
          event_tracks (
            track_id,
            name
          )
        )
      `
      )
      .contains("teammates", [profile.email]);

    if (teamError) {
      console.error("Error fetching team projects:", teamError);
      return NextResponse.json(
        { error: "Failed to fetch team projects" },
        { status: 500 }
      );
    }

    // Combine and deduplicate projects
    const allProjects = [...(leadProjects || []), ...(teamProjects || [])]
      .filter(
        (project, index, self) =>
          index === self.findIndex((p) => p.id === project.id)
      )
      .map((project) => ({
        id: project.id,
        project_name: project.project_name,
        project_description: project.project_description,
        lead_name: project.lead_name,
        lead_email: project.lead_email,
        teammates: project.teammates,
        project_url: project.project_url,
        cover_image_url: project.cover_image_url,
        event_id: project.event_id,
        created_at: project.created_at,
        track_ids:
          project.project_tracks
            ?.map((pt) => pt.event_tracks?.[0]?.track_id)
            .filter(Boolean) || [],
        tracks:
          project.project_tracks
            ?.map((pt) => ({
              track_id: pt.event_tracks?.[0]?.track_id || "",
              name: pt.event_tracks?.[0]?.name || "",
              event_id: project.event_id,
              description: "",
              scoring_criteria: {
                name: pt.event_tracks?.[0]?.name || "",
                criteria: [],
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }))
            .filter(Boolean) || [],
      }));

    // Fetch events where user has roles
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select(
        `
        event_id,
        event_name,
        slug,
        event_date,
        location,
        visibility,
        cover_image_url,
        scoring_config,
        role_labels,
        user_event_roles!inner (
          role
        )
      `
      )
      .eq("user_event_roles.user_id", userId)
      .in("visibility", ["public", "private"]);

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    // Fetch prizes for all projects
    if (allProjects.length > 0) {
      const projectIds = allProjects.map((p) => p.id);
      const { data: prizesData, error: prizesError } = await supabase
        .from("prize_winners")
        .select(
          `
          id,
          prize_id,
          project_id
          `
        )
        .in("project_id", projectIds);

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
          const projectId = prize.project_id!;
          if (!acc[projectId]) acc[projectId] = [];
          acc[projectId].push(prize);
          return acc;
        },
        {} as Record<string, typeof prizesData>
      );

      // Add prizes to projects
      allProjects.forEach((project: { id: string; [key: string]: unknown }) => {
        (project as { prizes_won?: Record<string, unknown>[] }).prizes_won =
          prizesByProject[project.id] || [];
      });
    }

    return NextResponse.json({
      profile,
      projects: allProjects,
      events: events || [],
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
