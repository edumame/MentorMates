import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logAgentEvent } from "@/lib/agent/logging";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";

// An empty array is allowed and clears every track assignment for the project.
// Duplicate ids are collapsed so the response reflects the stored set.
const updateTracksSchema = z.object({
  track_ids: z
    .array(z.string().uuid())
    .transform((ids) => Array.from(new Set(ids.map((id) => id.toLowerCase())))),
});

const projectIdSchema = z.string().uuid();

/**
 * PATCH /api/projects/[projectId]/tracks
 * Organizers (or platform admins) can override which tracks a project is
 * submitted to. Replaces the full set of track assignments atomically via the
 * service-only `replace_project_tracks` RPC, after route-level authorization.
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

    if (!projectIdSchema.safeParse(projectId).success) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = updateTracksSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { track_ids } = parsed.data;

    // Service client for lookups and the write: authorization is enforced
    // explicitly below, and project_tracks RLS does not admit platform admins.
    const service = createSupabaseServiceClient();

    const { data: project, error: projectError } = await service
      .from("projects")
      .select("id, event_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) {
      console.error("Error loading project for track override:", projectError);
      return NextResponse.json(
        { error: "Failed to load project" },
        { status: 500 }
      );
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.event_id) {
      return NextResponse.json(
        { error: "Project is not associated with an event; tracks cannot be assigned" },
        { status: 400 }
      );
    }

    // Verify the user is an organizer/admin for this event, or a platform admin
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

    // Validate that all requested track_ids belong to this event (the RPC
    // re-checks inside its transaction; this gives a clear early 400).
    if (track_ids.length > 0) {
      const { data: validTracks, error: tracksError } = await service
        .from("event_tracks")
        .select("track_id")
        .eq("event_id", project.event_id)
        .in("track_id", track_ids);

      if (tracksError) {
        console.error("Error validating event tracks:", tracksError);
        return NextResponse.json(
          { error: "Failed to validate tracks" },
          { status: 500 }
        );
      }

      if (!validTracks || validTracks.length !== track_ids.length) {
        return NextResponse.json(
          { error: "One or more tracks do not belong to this event" },
          { status: 400 }
        );
      }
    }

    const { data: replaced, error: replaceError } = await service.rpc(
      "replace_project_tracks",
      { p_project_id: projectId, p_track_ids: track_ids }
    );

    if (replaceError) {
      // 22023 = invalid_parameter_value, raised for tracks outside the event or
      // a project that lost its event between the checks above and the write.
      if (replaceError.code === "22023") {
        return NextResponse.json(
          { error: "One or more tracks do not belong to this event" },
          { status: 400 }
        );
      }
      if (replaceError.code === "P0002") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      console.error("Error replacing project tracks:", replaceError);
      return NextResponse.json(
        { error: "Failed to update tracks" },
        { status: 500 }
      );
    }

    const result = Array.isArray(replaced) ? replaced[0] : undefined;
    if (!result) {
      console.error("replace_project_tracks returned no result", { projectId });
      return NextResponse.json(
        { error: "Failed to update tracks" },
        { status: 500 }
      );
    }

    // Audit trail: structured log line (no durable audit table exists yet).
    logAgentEvent(
      "project_tracks_overridden",
      {
        route: "PATCH /api/projects/[projectId]/tracks",
        userId: user.id,
        eventId: project.event_id,
        projectId,
        actorRole: isOrganizer ? roleRow?.role : "platform_admin",
        previousTrackIds: result.previous_track_ids,
        trackIds: result.track_ids,
      },
      undefined,
      "info"
    );

    return NextResponse.json({
      success: true,
      project_id: projectId,
      track_ids: result.track_ids,
      previous_track_ids: result.previous_track_ids,
      message: `Project tracks updated to ${result.track_ids.length} track(s)`,
    });
  } catch (error) {
    console.error("Error updating project tracks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
