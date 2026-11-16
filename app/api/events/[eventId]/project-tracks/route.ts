import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { canManageEvent } from "@/lib/events/manage-access";
import {
  findTracksOutsideEvent,
  setProjectTracks,
  type TrackAssignment,
} from "@/lib/projects/project-tracks";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const MAX_ASSIGNMENTS = 1000;
const MAX_TRACKS_PER_PROJECT = 50;
// Keeps each `.in()` lookup URL well under PostgREST/proxy limits.
const PROJECT_LOOKUP_CHUNK = 200;

const bodySchema = z.object({
  mode: z.enum(["add", "replace"]),
  assignments: z
    .array(
      z.object({
        projectId: z.string().uuid(),
        trackIds: z.array(z.string().uuid()).max(MAX_TRACKS_PER_PROJECT),
      }),
    )
    .min(1)
    .max(MAX_ASSIGNMENTS),
});

/**
 * POST /api/events/[eventId]/project-tracks
 *
 * Organizer bulk track assignment (CSV import, "assign all projects to this
 * track"). Body: { mode: "add" | "replace", assignments: [{ projectId, trackIds }] }
 *   add     -> trackIds are added to each project; existing tracks are kept
 *   replace -> each listed project ends with exactly its trackIds
 * Every project and track must belong to this event. The whole batch is
 * applied atomically: on any error nothing changes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
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

    const { eventId } = await params;
    if (!z.string().uuid().safeParse(eventId).success) {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const service = createSupabaseServiceClient();
    if (!(await canManageEvent(service, eventId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const assignments = mergeAssignments(parsed.data.assignments);
    const projectIds = assignments.map((assignment) => assignment.projectId);

    const projectsInEvent = await findProjectsInEvent(service, eventId, projectIds);
    if (projectsInEvent === null) {
      return NextResponse.json(
        { error: "Could not check the event's projects. Please try again." },
        { status: 503 },
      );
    }
    const projectsOutside = projectIds.filter((id) => !projectsInEvent.has(id));
    if (projectsOutside.length > 0) {
      return NextResponse.json(
        {
          error: "One or more projects do not belong to this event",
          code: "project_not_in_event",
          invalidProjectIds: projectsOutside,
        },
        { status: 400 },
      );
    }

    const allTrackIds = assignments.flatMap((assignment) => assignment.trackIds);
    const tracksOutside = await findTracksOutsideEvent(service, eventId, allTrackIds);
    if (tracksOutside === null) {
      return NextResponse.json(
        { error: "Could not check the event's tracks. Please try again." },
        { status: 503 },
      );
    }
    if (tracksOutside.length > 0) {
      return NextResponse.json(
        {
          error: "One or more tracks do not belong to this event",
          code: "track_not_in_event",
          invalidTrackIds: tracksOutside,
        },
        { status: 400 },
      );
    }

    const result = await setProjectTracks(service, assignments, {
      replace: parsed.data.mode === "replace",
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    return NextResponse.json({
      projectCount: assignments.length,
      added: result.added,
      removed: result.removed,
    });
  } catch (error) {
    console.error("[event project tracks] POST failed", error);
    return NextResponse.json(
      { error: "Failed to update project tracks" },
      { status: 500 },
    );
  }
}

/** One entry per project; a project listed twice gets the union of its tracks. */
function mergeAssignments(assignments: TrackAssignment[]): TrackAssignment[] {
  const byProject = new Map<string, Set<string>>();
  for (const { projectId, trackIds } of assignments) {
    const tracks = byProject.get(projectId) ?? new Set<string>();
    trackIds.forEach((trackId) => tracks.add(trackId));
    byProject.set(projectId, tracks);
  }
  return Array.from(byProject, ([projectId, tracks]) => ({
    projectId,
    trackIds: Array.from(tracks),
  }));
}

async function findProjectsInEvent(
  service: ReturnType<typeof createSupabaseServiceClient>,
  eventId: string,
  projectIds: string[],
): Promise<Set<string> | null> {
  const found = new Set<string>();
  for (let i = 0; i < projectIds.length; i += PROJECT_LOOKUP_CHUNK) {
    const chunk = projectIds.slice(i, i + PROJECT_LOOKUP_CHUNK);
    const { data, error } = await service
      .from("projects")
      .select("id")
      .eq("event_id", eventId)
      .in("id", chunk);
    if (error) {
      console.error("[event project tracks] project lookup failed", { eventId, error });
      return null;
    }
    (data ?? []).forEach((row) => found.add(row.id));
  }
  return found;
}
