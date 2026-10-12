import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getProjectEditAccess } from "@/lib/projects/access";
import {
  normalizeProjectWriteInput,
  saveProjectSubmission,
} from "@/lib/projects/submission-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
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

    const { projectId } = await params;
    const body = await request.json();
    const parsed = normalizeProjectWriteInput(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const accessResult = await getProjectEditAccess(supabase, {
      projectId,
      userId: user.id,
      userEmail: user.email,
    });

    if (!accessResult.access) {
      return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
    }

    if (!accessResult.access.canEdit) {
      return NextResponse.json(
        { error: "Unauthorized to edit this project" },
        { status: 403 }
      );
    }

    const result = await saveProjectSubmission(supabase, {
      input: parsed.data,
      mode: "update",
      projectId,
    });

    if ("error" in result) {
      return NextResponse.json(
        Object.fromEntries(
          Object.entries(result).filter(([key]) => !["status"].includes(key))
        ),
        { status: result.status }
      );
    }

    if ("message" in result) {
      return NextResponse.json({ message: result.message });
    }

    return NextResponse.json({
      success: true,
      project: result.project,
    });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
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

    const { projectId } = await params;

    // First check if the user has permission to delete this project
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("lead_email, submitted, event_id")
      .eq("id", projectId)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch project" },
        { status: 400 }
      );
    }

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const isProjectLead = project.lead_email === user.email;

    // Check if user is an organizer for the event
    let isOrganizer = false;
    if (project.event_id) {
      const { data: organizerRole } = await supabase
        .from("user_event_roles")
        .select("role")
        .eq("event_id", project.event_id)
        .eq("user_id", user.id)
        .eq("role", "organizer")
        .single();

      isOrganizer = !!organizerRole;
    }

    // Project leads can only delete unsubmitted projects
    if (isProjectLead && !isOrganizer) {
      if (project.submitted) {
        return NextResponse.json(
          { error: "Cannot delete submitted projects from the dashboard." },
          { status: 400 }
        );
      }
    }

    // Must be either project lead or organizer to delete
    if (!isProjectLead && !isOrganizer) {
      return NextResponse.json(
        { error: "Unauthorized to delete this project" },
        { status: 403 }
      );
    }

    // Delete project_tracks first (foreign key constraint)
    await supabase
      .from("project_tracks")
      .delete()
      .eq("project_id", projectId);

    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete project" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
