import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";

export async function GET(
  _request: Request,
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
      roleRow &&
      canAccessRole(roleRow.role as EventRole, EventRole.Organizer);

    if (!isOrganizer && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: projectsInEvent, error: projectError } = await serviceSupabase
      .from("projects")
      .select("id")
      .eq("event_id", eventId);

    if (projectError) {
      return NextResponse.json(
        { error: "Failed to fetch event projects" },
        { status: 500 }
      );
    }

    if (!projectsInEvent || projectsInEvent.length === 0) {
      return NextResponse.json({ assignments: [] });
    }

    const projectIds = projectsInEvent.map((p) => p.id);

    const { data: assignmentData, error } = await serviceSupabase
      .from("project_assignments")
      .select(
        `
        id,
        project_id,
        user_id,
        role,
        projects:project_id (
          id,
          project_name,
          lead_name
        ),
        user_profiles:user_id (
          display_name,
          email
        )
      `
      )
      .in("project_id", projectIds);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch assignments" },
        { status: 500 }
      );
    }

    const assignments = (assignmentData || []).map((row) => {
      const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
      const profile = Array.isArray(row.user_profiles)
        ? row.user_profiles[0]
        : row.user_profiles;

      return {
        id: row.id,
        project_id: row.project_id,
        user_id: row.user_id,
        role: row.role,
        project: {
          id: project?.id || row.project_id,
          project_name: project?.project_name || "Unknown Project",
          lead_name: project?.lead_name || "Unknown Lead",
        },
        user: {
          user_id: row.user_id,
          display_name:
            profile?.display_name || profile?.email?.split("@")[0] || "Unknown User",
          email: profile?.email || "",
          role: row.role,
        },
      };
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error("Error in GET /api/events/[eventId]/project-assignments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
