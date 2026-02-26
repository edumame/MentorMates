import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import {
  coerceSubmissionAnswerValue,
  deriveLegacySubmissionFieldsFromArtifacts,
  normalizeProjectArtifacts,
  submissionAnswerInputSchema,
} from "@/features/projects/utils/submission";

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
    const incomingAnswersRaw =
      body.submission_answers !== undefined
        ? body.submission_answers
        : body.submissionAnswers;

    const hasArtifactsPayload = "artifacts" in body;
    const normalizedArtifacts = hasArtifactsPayload
      ? normalizeProjectArtifacts(body.artifacts)
      : null;

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

    if (normalizedArtifacts) {
      const legacyFields =
        deriveLegacySubmissionFieldsFromArtifacts(normalizedArtifacts);
      updateData.project_url = legacyFields.project_url;
      updateData.video_url = legacyFields.video_url;
      updateData.additional_materials_url = legacyFields.additional_materials_url;
    }

    const { data: existingProject, error: existingProjectError } = await supabase
      .from("projects")
      .select("id, event_id")
      .eq("id", projectId)
      .single();

    if (existingProjectError || !existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (
      Object.keys(updateData).length === 0 &&
      !hasArtifactsPayload &&
      incomingAnswersRaw === undefined
    ) {
      return NextResponse.json({ message: "No updates provided" });
    }

    if (Object.keys(updateData).length > 0) {
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
    }

    if (normalizedArtifacts) {
      const { error: deleteArtifactsError } = await supabase
        .from("project_artifacts")
        .delete()
        .eq("project_id", projectId);
      if (deleteArtifactsError) {
        return NextResponse.json(
          { error: "Failed to update project artifacts" },
          { status: 500 }
        );
      }

      if (normalizedArtifacts.length > 0) {
        const { error: insertArtifactsError } = await supabase
          .from("project_artifacts")
          .insert(
            normalizedArtifacts.map((artifact) => ({
              project_id: projectId,
              kind: artifact.kind,
              label: artifact.label,
              url: artifact.url,
              sort_order: artifact.sort_order,
              is_primary: artifact.is_primary,
              metadata: artifact.metadata,
            }))
          );
        if (insertArtifactsError) {
          return NextResponse.json(
            { error: "Failed to save project artifacts" },
            { status: 500 }
          );
        }
      }
    }

    if (incomingAnswersRaw !== undefined) {
      const parsedAnswers = Array.isArray(incomingAnswersRaw)
        ? incomingAnswersRaw
            .map((item) => submissionAnswerInputSchema.safeParse(item))
            .filter((item) => item.success)
            .map((item) => item.data)
        : [];

      const answerFieldIds = [
        ...new Set(parsedAnswers.map((answer) => answer.eventSubmissionFieldId)),
      ];
      let normalizedAnswers: Array<{
        project_id: string;
        event_submission_field_id: string;
        answer: string | string[];
      }> = [];

      if (answerFieldIds.length > 0) {
        const projectEventId = (body.event_id || existingProject.event_id) as
          | string
          | null;
        if (!projectEventId) {
          return NextResponse.json(
            { error: "Submission answers require the project to belong to an event" },
            { status: 400 }
          );
        }

        const { data: fieldRows, error: fieldQueryError } = await supabase
          .from("event_submission_fields")
          .select("id, event_id, field_type")
          .in("id", answerFieldIds)
          .eq("event_id", projectEventId);

        if (fieldQueryError || !fieldRows || fieldRows.length !== answerFieldIds.length) {
          return NextResponse.json(
            { error: "Invalid submission field IDs" },
            { status: 400 }
          );
        }

        const fieldById = new Map(
          fieldRows.map((field) => [
            field.id,
            field.field_type as "short_text" | "long_text" | "url" | "multi_url",
          ])
        );

        normalizedAnswers = parsedAnswers
          .map((answer) => {
            const fieldType = fieldById.get(answer.eventSubmissionFieldId);
            if (!fieldType) return null;
            const coerced = coerceSubmissionAnswerValue(fieldType, answer.answer);
            if (coerced === null) return null;
            if (typeof coerced === "string" && coerced.length === 0) return null;
            if (Array.isArray(coerced) && coerced.length === 0) return null;
            return {
              project_id: projectId,
              event_submission_field_id: answer.eventSubmissionFieldId,
              answer: coerced,
            };
          })
          .filter(Boolean) as Array<{
          project_id: string;
          event_submission_field_id: string;
          answer: string | string[];
        }>;
      }

      const { error: deleteAnswersError } = await supabase
        .from("project_submission_answers")
        .delete()
        .eq("project_id", projectId);
      if (deleteAnswersError) {
        return NextResponse.json(
          { error: "Failed to update submission answers" },
          { status: 500 }
        );
      }

      if (normalizedAnswers.length > 0) {
        const { error: insertAnswersError } = await supabase
          .from("project_submission_answers")
          .insert(normalizedAnswers);
        if (insertAnswersError) {
          return NextResponse.json(
            { error: "Failed to save submission answers" },
            { status: 500 }
          );
        }
      }
    }

    const { data: updatedProject } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    return NextResponse.json({ success: true, project: updatedProject });
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
