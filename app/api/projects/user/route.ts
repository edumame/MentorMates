import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { isPrizeFromEvent, type PrizeWithEvent } from "@/lib/projects/awards";
import { Prize } from "@/lib/types";
import { getTeamEmails, getUserProjectIds } from "@/lib/projects/membership";
import { PROJECT_CLIENT_COLUMNS } from "@/lib/projects/columns";

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

    // Membership via my_project_ids (the email columns are not client-readable).
    const { ids: myIds, error: idsError } = await getUserProjectIds(supabase);
    if (idsError || !myIds) {
      console.error("Error fetching user projects:", idsError);
      return NextResponse.json(
        { error: "Failed to fetch projects" },
        { status: 500 }
      );
    }

    const { data: projectRows, error: projectsError } = myIds.length
      ? await supabase
          .from("projects")
          .select(
            `
        ${PROJECT_CLIENT_COLUMNS},
        project_tracks (
          event_tracks (
            track_id,
            name
          )
        )`
          )
          .in("id", myIds)
      : { data: [], error: null };

    if (projectsError) {
      console.error("Error fetching user projects:", projectsError);
      return NextResponse.json(
        { error: "Failed to fetch projects" },
        { status: 500 }
      );
    }

    // The caller is on every one of these teams, so team emails are allowed.
    const teamEmails = await getTeamEmails(supabase, myIds);
    const allProjects = ((projectRows ?? []) as unknown as Array<{ id: string } & Record<string, unknown>>).map(
      (project): { id: string; prizes_won?: Prize[] } & Record<string, unknown> => ({
        ...project,
        lead_email: teamEmails.get(project.id)?.lead_email ?? "",
        teammates: teamEmails.get(project.id)?.teammates ?? [],
      })
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
          event_tracks ( event_id ),
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

      // Group prizes by project_id, counting only prizes from the project's
      // current event so status does not follow a project that changed event
      const projectEventIds = new Map(
        allProjects.map((p) => [p.id, p.event_id as string | null | undefined])
      );
      const prizesByProject = (prizesData || []).reduce(
        (acc, prize) => {
          prize.prize_winners.forEach((winner) => {
            const projectId = winner.project_id;
            if (
              !isPrizeFromEvent(
                prize as unknown as PrizeWithEvent,
                projectEventIds.get(projectId)
              )
            ) {
              return;
            }
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
