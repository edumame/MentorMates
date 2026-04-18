import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import {
  normalizeProjectWriteInput,
  saveProjectSubmission,
} from "@/lib/projects/submission-service";
type SubmittedProjectMembership = {
  id: string;
  lead_email: string | null;
  teammates: string[] | null;
};

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

function projectIncludesParticipant(
  project: SubmittedProjectMembership,
  participantEmail: string,
) {
  if (!participantEmail) {
    return false;
  }

  if (normalizeEmail(project.lead_email) === participantEmail) {
    return true;
  }

  return (project.teammates ?? []).some(
    (teammateEmail) => normalizeEmail(teammateEmail) === participantEmail,
  );
}

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!user || userError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const participantEmail = normalizeEmail(user.email);
    if (!participantEmail) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const parsed = normalizeProjectWriteInput({
      ...body,
      leadEmail: body?.leadEmail ?? body?.lead_email ?? user.email ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (parsed.data.eventId && !parsed.data.projectId) {
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("event_id, max_projects")
        .eq("event_id", parsed.data.eventId)
        .single();

      if (eventError) {
        return NextResponse.json(
          { error: "Failed to fetch event data" },
          { status: 500 },
        );
      }

      if (eventData?.max_projects) {
        const { data: submittedProjects, error: submittedProjectsError } =
          await supabase
            .from("projects")
            .select("id, lead_email, teammates")
            .eq("event_id", parsed.data.eventId)
            .eq("submitted", true);

        if (submittedProjectsError) {
          return NextResponse.json(
            { error: "Failed to fetch submitted projects" },
            { status: 500 },
          );
        }

        const participantSubmittedCount = (
          (submittedProjects as SubmittedProjectMembership[] | null) ?? []
        ).filter((project) =>
          projectIncludesParticipant(project, participantEmail),
        ).length;

        if (participantSubmittedCount >= eventData.max_projects) {
          return NextResponse.json(
            {
              error: `You have reached the maximum of ${eventData.max_projects} submitted projects for this event.`,
              max_projects: eventData.max_projects,
              current_count: participantSubmittedCount,
            },
            { status: 409 },
          );
        }
      }
    }

    const result = await saveProjectSubmission(supabase, {
      input: parsed.data,
      mode: parsed.data.projectId ? "update" : "create",
      projectId: parsed.data.projectId,
      defaultSubmitted: true,
    });

    if ("error" in result) {
      return NextResponse.json(
        Object.fromEntries(
          Object.entries(result).filter(([key]) => !["status"].includes(key)),
        ),
        { status: result.status },
      );
    }

    return NextResponse.json({ data: result.project });
  } catch (error) {
    console.error("[submit] unhandled exception in POST /api/projects/submit", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
