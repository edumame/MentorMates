import { normalizeProjectWriteInput, saveProjectSubmission } from "@/lib/projects/submission-service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";

const submitForParticipantSchema = z.object({
  participant_user_id: z.string().uuid(),
  project: z.object({
    project_name: z.string().min(1).max(200),
    project_description: z.string().max(5000).optional(),
    project_url: z.string().url().nullable().optional(),
    video_url: z.string().url().nullable().optional(),
    additional_materials_url: z.string().url().nullable().optional(),
    cover_image_url: z.string().url().nullable().optional(),
    submission_answers: z.unknown().optional(),
    teammates: z.array(z.string()).optional().default([]),
    track_ids: z.array(z.string().uuid()).optional().default([]),
  }),
  submit_immediately: z.boolean().optional().default(true),
});

/**
 * POST /api/events/[eventId]/projects/submit-for-participant
 *
 * Lets an organizer submit a project on behalf of a participant who for some
 * reason couldn't submit themselves (tech issues, submitted via email, etc.).
 *
 * Creates a project with lead_email = participant's email, optionally marks
 * as submitted, and assigns the specified tracks.
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
      return NextResponse.json(
        { error: "Only organizers can submit on behalf of participants" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = submitForParticipantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { participant_user_id, project, submit_immediately } = parsed.data;

    const serviceSupabase = createSupabaseServiceClient();

    // Fetch the participant's profile to get their name/email
    const { data: participantProfile, error: profileError } = await serviceSupabase
      .from("user_profiles")
      .select("uid, display_name, email")
      .eq("uid", participant_user_id)
      .maybeSingle();

    if (profileError || !participantProfile) {
      return NextResponse.json(
        { error: "Participant profile not found" },
        { status: 404 }
      );
    }

    if (!participantProfile.email) {
      return NextResponse.json(
        { error: "Participant has no email on file — cannot submit" },
        { status: 400 }
      );
    }

    // Verify the participant is actually in this event
    const { data: participantRole } = await serviceSupabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", participant_user_id)
      .maybeSingle();

    if (!participantRole) {
      return NextResponse.json(
        { error: "User is not a participant of this event" },
        { status: 400 }
      );
    }

    // Use the same normalization, field validation, and error handling as participant submissions.
    const normalized = normalizeProjectWriteInput({
      ...project,
      event_id: eventId,
      lead_name: participantProfile.display_name || participantProfile.email.split("@")[0],
      lead_email: participantProfile.email,
      submitted: submit_immediately,
    });
    if (!normalized.success) {
      return NextResponse.json({ error: "Invalid project", details: normalized.error.flatten() }, { status: 400 });
    }
    const result = await saveProjectSubmission(serviceSupabase, {
      input: normalized.data,
      mode: "create",
      defaultSubmitted: submit_immediately,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const createdProject = result.project;
    if (!createdProject) {
      return NextResponse.json({ error: "Project was not created" }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        project: createdProject,
        participant: {
          user_id: participantProfile.uid,
          display_name: participantProfile.display_name,
          email: participantProfile.email,
        },
        message: `Project "${createdProject.project_name}" created for ${participantProfile.display_name || participantProfile.email}${submit_immediately ? " and marked as submitted" : " as a draft"}.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in submit-for-participant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
