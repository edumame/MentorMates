import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import {
  EventRole,
  EventTrack,
  Prize,
  ProjectFromDatabase,
  ProjectWithPrizes,
} from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";
import { createContextusProject } from "@/lib/integrations/contextus";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const projectId = searchParams.get("projectId");
    const isPublic = searchParams.get("public") === "true";
    const submitted = searchParams.get("submitted") === "true";

    // For public gallery view, no authentication required
    if (isPublic && eventId) {
      // Public view - fetch all projects for the event
      const { data: allProjects, error } = await supabase
        .from("projects")
        .select(
          `
          id,
          project_name,
          lead_name,
          lead_email,
          project_description,
          teammates,
          project_url,
          additional_materials_url,
          cover_image_url,
          event_id,
          contextus_project_id,
          created_at,
          submitted,
          project_tracks (
            event_tracks (
              track_id,
              event_id,
              name,
              description,
              label,
              prize_amount,
              prize_description,
              scoring_criteria,
              created_at,
              updated_at
            )
          )
        `
        )
        .eq("event_id", eventId)
        .eq("submitted", true)
        .order("project_name")
        .overrideTypes<
          Array<{ project_tracks: Array<{ event_tracks: EventTrack }> }>
        >();

      if (error) {
        console.error("Error fetching projects:", error);
        return NextResponse.json(
          { error: "Failed to fetch projects" },
          { status: 500 }
        );
      }

      const projects = (allProjects || []).map((item: ProjectFromDatabase) => ({
        id: item.id,
        project_name: item.project_name,
        lead_name: item.lead_name,
        lead_email: item.lead_email,
        project_description: item.project_description,
        teammates: item.teammates,
        project_url: item.project_url,
        additional_materials_url: item.additional_materials_url,
        cover_image_url: item.cover_image_url,
        event_id: item.event_id,
        contextus_project_id: (
          item as unknown as { contextus_project_id?: string }
        ).contextus_project_id,
        submitted:
          (item as unknown as { submitted?: boolean }).submitted ?? true,
        tracks:
          item.project_tracks?.map((pt) => pt.event_tracks).filter(Boolean) ||
          [],
        track_ids:
          item.project_tracks
            ?.map((pt) => pt.event_tracks?.track_id)
            .filter(Boolean) || [],
        created_at: item.created_at,
      }));

      // Fetch prizes for all projects
      if (projects.length > 0) {
        const projectIds = projects.map((p) => p.id);
        const { data: prizesData } = await supabase
          .from("prizes")
          .select(
            `
            id,
            track_id,
            prize_amount,
            prize_description,
            prize_winners (
              id,
              project_id,
              assigned_at,
              assigned_by,
              projects (
                id,
                project_name,
                lead_name,
                event_id
              )
            )
          `
          )
          .in("prize_winners.project_id", projectIds);

        if (prizesData) {
          const prizesByProject: Record<string, Prize[]> = {};

          // Iterate through each prize and its winners
          prizesData.forEach((prize) => {
            if (prize.prize_winners && prize.prize_winners.length > 0) {
              prize.prize_winners.forEach((winner) => {
                const projectId = winner.project_id;
                if (projectId) {
                  if (!prizesByProject[projectId]) {
                    prizesByProject[projectId] = [];
                  }
                  prizesByProject[projectId].push({
                    id: prize.id,
                    track_id: prize.track_id,
                    prize_amount: prize.prize_amount,
                    prize_description: prize.prize_description,
                    assigned_at: winner.assigned_at,
                    assigned_by: winner.assigned_by,
                  });
                }
              });
            }
          });

          projects.forEach(
            (project: { id: string; [key: string]: unknown }) => {
              (project as unknown as ProjectWithPrizes).prizes_won =
                (prizesByProject[project.id] || []) as Prize[];
            }
          );
        }
      }

      return NextResponse.json({ projects });
    }

    // For all other requests, require authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Handle single project fetch by ID
    if (projectId) {
      const { data: project, error } = await supabase
        .from("projects")
        .select(
          `
          id,
          project_name,
          lead_name,
          lead_email,
          project_description,
          teammates,
          project_url,
          additional_materials_url,
          cover_image_url,
          event_id,
          contextus_project_id,
          created_at,
          submitted,
          project_tracks (
            event_tracks (
              track_id,
              event_id,
              name,
              description,
              label,
              prize_amount,
              prize_description,
              scoring_criteria,
              created_at,
              updated_at
            )
          )
        `
        )
        .eq("id", projectId)
        .single()
        .overrideTypes<{
          project_tracks: Array<{ event_tracks: EventTrack }>;
        }>();

      if (error) {
        console.error("Error fetching project:", error);
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      // Transform project data
      const transformedProject = {
        id: project.id,
        project_name: project.project_name,
        lead_name: project.lead_name,
        lead_email: project.lead_email,
        project_description: project.project_description,
        teammates: project.teammates,
        project_url: project.project_url,
        additional_materials_url: project.additional_materials_url,
        cover_image_url: project.cover_image_url,
        event_id: project.event_id,
        contextus_project_id: (
          project as unknown as { contextus_project_id?: string }
        ).contextus_project_id,
        submitted:
          (project as unknown as { submitted?: boolean }).submitted ?? false,
        tracks:
          project.project_tracks
            ?.map((pt) => pt.event_tracks)
            .filter(Boolean) || [],
        track_ids:
          project.project_tracks
            ?.map((pt) => pt.event_tracks?.track_id)
            .filter(Boolean) || [],
        created_at: project.created_at,
      };

      // Fetch prizes for this project by starting from prize_winners
      const { data: prizeWinnersData } = await supabase
        .from("prize_winners")
        .select(
          `
            id,
            project_id,
            assigned_at,
            assigned_by,
            prizes (
              id,
              track_id,
              prize_amount,
              prize_description
            )
          `
        )
        .eq("project_id", transformedProject.id)
        .overrideTypes<
          Array<{
            id: string;
            project_id: string;
            assigned_at: string;
            assigned_by: string;
            prizes: {
              id: string;
              track_id: string;
              prize_amount: number;
              prize_description: string;
            };
          }>
        >();

      if (prizeWinnersData) {
        (transformedProject as unknown as ProjectWithPrizes).prizes_won =
          prizeWinnersData as unknown as Prize[];
      }

      return NextResponse.json({ project: transformedProject });
    }

    // Handle projects by event (for organizers)
    if (eventId) {
      // Check if user is organizer for this event
      const { data: userRole } = await supabase
        .from("user_event_roles")
        .select("role")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .single();

      if (
        !userRole ||
        !canAccessRole(userRole.role as EventRole, EventRole.Organizer)
      ) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 }
        );
      }

      // Organizer view - fetch all projects with track relationships
      const query = supabase
        .from("projects")
        .select(
          `
            *,
            project_tracks (
              track_id
            )
          `
        )
        .eq("event_id", eventId);

      if (submitted) {
        query.eq("submitted", true);
      }

      const { data: projectsData, error } = await query;

      if (error) {
        console.error("Error fetching projects:", error);
        return NextResponse.json(
          { error: "Failed to fetch projects" },
          { status: 500 }
        );
      }

      const transformedProjects = (projectsData || []).map(
        (project: {
          project_tracks?: { track_id: string }[];
          [key: string]: unknown;
        }) => ({
          ...project,
          track_ids:
            project.project_tracks?.map(
              (pt: { track_id: string }) => pt.track_id
            ) || [],
        })
      );

      return NextResponse.json({ projects: transformedProjects });
    }

    // If no specific parameters, return error
    return NextResponse.json(
      { error: "Missing required parameters" },
      { status: 400 }
    );
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { eventId, leadName, leadEmail, projectName, contextus } = body as {
      eventId?: string;
      leadName?: string;
      leadEmail?: string;
      projectName?: string;
      contextus?: boolean;
    };

    const insertPayload: Record<string, unknown> = {
      event_id: eventId || null,
      lead_name: leadName || user.user_metadata?.full_name || user.email || "",
      lead_email: leadEmail || user.email,
      project_name: projectName || null,
      submitted: false,
    };

    const { data, error } = await supabase
      .from("projects")
      .insert(insertPayload)
      .select("id, lead_name, lead_email, event_id, project_name")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to create draft project" },
        { status: 400 }
      );
    }

    if (contextus) {
      // Immediately create a Contextus project (best-effort)
      let createdContextusId: string | null = null;
      try {
        const label =
          (data.project_name as string | null) ||
          (data.lead_name as string | null) ||
          "Project";
        const contextusPayload = {
          label,
          metadata: {
            mentor_mates_project_id: data.id,
            team_lead_name: data.lead_name,
            team_lead_email: data.lead_email,
            ...(data.event_id ? { event_id: data.event_id } : {}),
          },
        };
        createdContextusId = await createContextusProject(contextusPayload);
        if (createdContextusId) {
          await supabase
            .from("projects")
            .update({ contextus_project_id: createdContextusId })
            .eq("id", data.id);
        }
      } catch (ctxErr) {
        console.error("Contextus create-on-draft failed:", ctxErr);
        // non-blocking
      }
      return NextResponse.json({
        id: data.id,
        contextus_project_id: createdContextusId,
      });
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error("Error creating draft project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
