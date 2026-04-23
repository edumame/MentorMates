import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";

const bulkAssignSchema = z.object({
  track_id: z.string().uuid(),
  user_ids: z.array(z.string().uuid()).min(1),
  role: z.enum([EventRole.Judge, EventRole.Mentor]).default(EventRole.Judge),
});

/**
 * POST /api/events/[eventId]/project-assignments/bulk-by-track
 *
 * Bulk-assigns judges (or mentors) to all projects in a specific track.
 * Use case: "All ElevenLabs judges should be assigned to the ElevenLabs track".
 *
 * Body: { track_id, user_ids, role }
 * Creates project_assignments rows for every (project, user) pair where the
 * project is submitted to the given track.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const supabase = await createSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = bulkAssignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { track_id, user_ids, role } = parsed.data;

    // Verify user is organizer/admin for this event
    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: isAdminRpc } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });

    const isOrganizer =
      roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Organizer);

    if (!isOrganizer && !Boolean(isAdminRpc)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify the track belongs to this event
    const { data: track } = await supabase
      .from("event_tracks")
      .select("track_id, event_id, name")
      .eq("track_id", track_id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (!track) {
      return NextResponse.json(
        { error: "Track not found for this event" },
        { status: 404 }
      );
    }

    // Get all submitted projects in this track
    const { data: projectTracks, error: ptError } = await supabase
      .from("project_tracks")
      .select("project_id, projects!inner(id, submitted, event_id)")
      .eq("track_id", track_id);

    if (ptError) {
      console.error("Error fetching project tracks:", ptError);
      return NextResponse.json(
        { error: "Failed to fetch projects for track" },
        { status: 500 }
      );
    }

    const projectIds = (projectTracks || [])
      .filter((pt) => {
        const project = Array.isArray(pt.projects) ? pt.projects[0] : pt.projects;
        return project?.submitted && project?.event_id === eventId;
      })
      .map((pt) => pt.project_id);

    if (projectIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No submitted projects found in this track",
        assignments_created: 0,
      });
    }

    // Verify all user_ids are actually assigned the requested role for this event
    const { data: eligibleUsers } = await supabase
      .from("user_event_roles")
      .select("user_id")
      .eq("event_id", eventId)
      .in("role", [role, EventRole.Organizer, EventRole.Admin])
      .in("user_id", user_ids);

    const eligibleUserIds = new Set(
      (eligibleUsers || []).map((u) => u.user_id)
    );
    const validUserIds = user_ids.filter((id) => eligibleUserIds.has(id));

    if (validUserIds.length === 0) {
      return NextResponse.json(
        { error: `None of the selected users have the ${role} role for this event` },
        { status: 400 }
      );
    }

    // Build the cross-product of (project × user) assignments
    const rows = projectIds.flatMap((project_id) =>
      validUserIds.map((user_id) => ({
        event_id: eventId,
        project_id,
        user_id,
        role,
      }))
    );

    // Upsert to avoid duplicate-key errors if some assignments already exist
    const { error: insertError, count } = await supabase
      .from("project_assignments")
      .upsert(rows, {
        onConflict: "project_id,user_id,role",
        ignoreDuplicates: true,
        count: "exact",
      });

    if (insertError) {
      console.error("Error bulk-assigning:", insertError);
      return NextResponse.json(
        { error: "Failed to create assignments" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      track_name: track.name,
      projects_in_track: projectIds.length,
      users_assigned: validUserIds.length,
      assignments_created: count ?? rows.length,
      message: `Assigned ${validUserIds.length} ${role}(s) to ${projectIds.length} project(s) in track "${track.name}"`,
    });
  } catch (error) {
    console.error("Bulk-by-track error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
