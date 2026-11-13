import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getProjectEditAccess } from "@/lib/projects/access";
// Edit rights are derived from the verified user; the team email columns are
// not readable by client roles, so the lookup uses the service client.
import { createSupabaseServiceClient } from "@/lib/supabase/service";
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

    const accessResult = await getProjectEditAccess(createSupabaseServiceClient(), {
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

    const service = createSupabaseServiceClient();
    const accessResult = await getProjectEditAccess(service, {
      projectId,
      userId: user.id,
      userEmail: user.email,
    });
    if (!accessResult.access) {
      return NextResponse.json(
        { error: accessResult.error },
        { status: accessResult.status }
      );
    }

    // The project lead may delete their own project, submitted or not; an
    // organizer of the project's event may delete any of its projects.
    // Teammates may not.
    const { isLead, isOrganizer } = accessResult.access;
    if (!isLead && !isOrganizer) {
      return NextResponse.json(
        { error: "Unauthorized to delete this project" },
        { status: 403 }
      );
    }

    // Service client after the check above. project_tracks, scores and other
    // per-project rows are removed by their ON DELETE CASCADE foreign keys.
    const { data: deletedRows, error: deleteError } = await service
      .from("projects")
      .delete()
      .eq("id", projectId)
      .select("id");

    if (deleteError) {
      console.error("Error deleting project:", { projectId, error: deleteError });
      return NextResponse.json(
        { error: "Failed to delete project" },
        { status: 500 }
      );
    }
    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
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
