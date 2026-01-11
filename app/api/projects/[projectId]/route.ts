import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";

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

    // Validate event_id change if provided
    if (body.event_id !== undefined) {
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("event_id, event_name, submission_time_start, submission_time_cutoff")
        .eq("event_id", body.event_id)
        .single();

      if (eventError || !eventData) {
        return NextResponse.json(
          { error: "Event not found" },
          { status: 404 }
        );
      }

      // Check submission time window
      const now = new Date();
      const submissionStart = new Date(eventData.submission_time_start);
      const submissionCutoff = new Date(eventData.submission_time_cutoff);

      if (now < submissionStart) {
        return NextResponse.json(
          { 
            error: "Project submission has not started yet",
            event_name: eventData.event_name,
            submission_start: eventData.submission_time_start
          },
          { status: 400 }
        );
      }

      if (now > submissionCutoff) {
        return NextResponse.json(
          { 
            error: "Project submission deadline has passed",
            event_name: eventData.event_name,
            submission_cutoff: eventData.submission_time_cutoff
          },
          { status: 400 }
        );
      }
    }

    const allowedFields: string[] = [
      "project_name",
      "project_description",
      "project_url",
      "additional_materials_url",
      "cover_image_url",
      "lead_name",
      "lead_email",
      "teammates",
      "video_url",
      "event_id",
    ];

    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) {
        updateData[key] = body[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: "No updates provided" });
    }

    const { error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", projectId);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to update project" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
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

