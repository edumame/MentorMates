import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";

const updateTracksSchema = z.object({
  track_ids: z.array(z.string().uuid()),
});

/**
 * PATCH /api/projects/[projectId]/tracks
 * Organizers can override which tracks a project is submitted to.
 * Replaces the full set of track assignments for the project.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const supabase = await createSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateTracksSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { track_ids } = parsed.data;

    // Look up the project to get its event_id
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, event_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify the user is an organizer/admin for this event
    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", project.event_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: isAdminRpc } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });

    const isOrganizer =
      roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Organizer);

    if (!isOrganizer && !Boolean(isAdminRpc)) {
      return NextResponse.json(
        { error: "Only organizers can override project tracks" },
        { status: 403 }
      );
    }

    // Validate that all requested track_ids belong to this event
    if (track_ids.length > 0) {
      const { data: validTracks } = await supabase
        .from("event_tracks")
        .select("track_id")
        .eq("event_id", project.event_id)
        .in("track_id", track_ids);

      if (!validTracks || validTracks.length !== track_ids.length) {
        return NextResponse.json(
          { error: "One or more tracks do not belong to this event" },
          { status: 400 }
        );
      }
    }

    // Replace the project's track assignments
    const { error: deleteError } = await supabase
      .from("project_tracks")
      .delete()
      .eq("project_id", projectId);

    if (deleteError) {
      console.error("Error clearing project tracks:", deleteError);
      return NextResponse.json(
        { error: "Failed to update tracks" },
        { status: 500 }
      );
    }

    if (track_ids.length > 0) {
      const inserts = track_ids.map((track_id) => ({
        project_id: projectId,
        track_id,
      }));

      const { error: insertError } = await supabase
        .from("project_tracks")
        .insert(inserts);

      if (insertError) {
        console.error("Error inserting project tracks:", insertError);
        return NextResponse.json(
          { error: "Failed to assign tracks" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      project_id: projectId,
      track_ids,
      message: `Project tracks updated to ${track_ids.length} track(s)`,
    });
  } catch (error) {
    console.error("Error updating project tracks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
