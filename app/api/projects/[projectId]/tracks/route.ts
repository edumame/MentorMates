import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getProjectEditAccess } from "@/lib/projects/access";
import {
  findTracksOutsideEvent,
  setProjectTracks,
} from "@/lib/projects/project-tracks";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const MAX_TRACKS_PER_PROJECT = 50;

const bodySchema = z.object({
  trackIds: z.array(z.string().uuid()).max(MAX_TRACKS_PER_PROJECT),
});

/**
 * Replace a project's tracks. Team members and organizers of the project's
 * event may call it. After the event's submission cutoff, only organizers may
 * change the tracks of a submitted project (participants could otherwise
 * re-enter different prize tracks while judging is under way).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
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
    if (!z.string().uuid().safeParse(projectId).success) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const trackIds = Array.from(new Set(parsed.data.trackIds));

    const service = createSupabaseServiceClient();
    const accessResult = await getProjectEditAccess(service, {
      projectId,
      userId: user.id,
      userEmail: user.email,
    });
    if (!accessResult.access) {
      return NextResponse.json(
        { error: accessResult.error },
        { status: accessResult.status },
      );
    }
    const { access } = accessResult;
    if (!access.canEdit) {
      return NextResponse.json(
        { error: "You don't have permission to edit this project's tracks" },
        { status: 403 },
      );
    }

    if (!access.eventId) {
      if (trackIds.length > 0) {
        return NextResponse.json(
          { error: "This project is not part of an event, so it has no tracks to choose from" },
          { status: 400 },
        );
      }
    } else {
      if (!access.isOrganizer) {
        const locked = await isLockedForParticipants(service, projectId, access.eventId);
        if (locked === null) {
          return NextResponse.json(
            { error: "Could not check the submission deadline. Please try again." },
            { status: 503 },
          );
        }
        if (locked) {
          return NextResponse.json(
            {
              error:
                "The submission deadline has passed, so this project's tracks can only be changed by an organizer",
              code: "submission_deadline_passed",
            },
            { status: 403 },
          );
        }
      }

      const outside = await findTracksOutsideEvent(service, access.eventId, trackIds);
      if (outside === null) {
        return NextResponse.json(
          { error: "Could not check the event's tracks. Please try again." },
          { status: 503 },
        );
      }
      if (outside.length > 0) {
        return NextResponse.json(
          {
            error: "One or more tracks do not belong to this project's event",
            code: "track_not_in_event",
            invalidTrackIds: outside,
          },
          { status: 400 },
        );
      }
    }

    const result = await setProjectTracks(
      service,
      [{ projectId, trackIds }],
      { replace: true },
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    return NextResponse.json({ trackIds });
  } catch (error) {
    console.error("[project tracks] PUT failed", error);
    return NextResponse.json(
      { error: "Failed to update project tracks" },
      { status: 500 },
    );
  }
}

/**
 * True when a submitted project's event is past its submission cutoff.
 * Drafts stay editable (they cannot be submitted after the cutoff anyway).
 * A legacy project with an unknown `submitted` state counts as submitted.
 * Returns `null` when the lookup fails, so the caller can fail closed.
 */
async function isLockedForParticipants(
  service: ReturnType<typeof createSupabaseServiceClient>,
  projectId: string,
  eventId: string,
): Promise<boolean | null> {
  const [projectLookup, eventLookup] = await Promise.all([
    service.from("projects").select("submitted").eq("id", projectId).maybeSingle(),
    service
      .from("events")
      .select("submission_time_cutoff")
      .eq("event_id", eventId)
      .maybeSingle(),
  ]);

  if (projectLookup.error || eventLookup.error || !projectLookup.data) {
    console.error("[project tracks] deadline lookup failed", {
      projectId,
      eventId,
      projectError: projectLookup.error,
      eventError: eventLookup.error,
    });
    return null;
  }

  if (projectLookup.data.submitted === false) return false;
  const cutoff = eventLookup.data?.submission_time_cutoff;
  return Boolean(cutoff && new Date() > new Date(cutoff));
}
