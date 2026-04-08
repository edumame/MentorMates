import { z } from "zod";
import type { Database, Json } from "@/lib/database.types";
import type { ServiceSupabaseClient } from "@/lib/supabase/service";
import { createContextusProject } from "@/lib/integrations/contextus";
import {
  buildArtifactsFromLegacy,
  coerceSubmissionAnswerValue,
  deriveLegacySubmissionFieldsFromArtifacts,
  normalizeProjectArtifacts,
  submissionAnswerInputSchema,
} from "@/features/projects/utils/submission";
import { buildNullLegacyProjectPayload } from "@/features/projects/utils/effectiveSubmission";
import {
  fetchArtifactsByProjectIds,
  fetchSubmissionAnswersByProjectIds,
  fetchSubmissionFieldsByEventIds,
  hydrateProjectsWithSubmissionData,
  type ProjectBaseRow,
} from "@/lib/projects/query";

const projectWriteSchema = z.object({
  projectId: z.string().uuid().optional(),
  projectName: z.string().max(200).optional(),
  leadName: z.string().max(200).optional(),
  leadEmail: z.string().email().max(320).optional(),
  projectDescription: z.string().max(20000).optional(),
  teammates: z.array(z.string()).optional(),
  projectUrl: z.string().optional(),
  coverImageUrl: z.string().optional(),
  additionalMaterialsUrl: z.string().optional(),
  eventId: z.string().uuid().nullable().optional(),
  trackIds: z.array(z.string().uuid()).optional(),
  videoUrl: z.string().optional(),
  artifacts: z.unknown().optional(),
  submissionAnswers: z.unknown().optional(),
  submitted: z.boolean().optional(),
  extraProjectUrls: z.array(z.string()).optional(),
  extraVideoUrls: z.array(z.string()).optional(),
  extraMaterialsUrls: z.array(z.string()).optional(),
});

export type NormalizedProjectWriteInput = z.infer<typeof projectWriteSchema>;

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

export function normalizeProjectWriteInput(body: unknown) {
  const payload =
    typeof body === "object" && body ? (body as Record<string, unknown>) : {};
  const rawTrackIds = payload.trackIds ?? payload.track_ids;

  return projectWriteSchema.safeParse({
    projectId: normalizeString(payload.projectId ?? payload.project_id),
    projectName: normalizeString(payload.projectName ?? payload.project_name),
    leadName: normalizeString(payload.leadName ?? payload.lead_name),
    leadEmail: normalizeString(payload.leadEmail ?? payload.lead_email),
    projectDescription: normalizeString(
      payload.projectDescription ?? payload.project_description,
    ),
    teammates: Array.isArray(payload.teammates)
      ? payload.teammates.filter(
          (item): item is string => typeof item === "string",
        )
      : undefined,
    projectUrl: normalizeString(payload.projectUrl ?? payload.project_url),
    coverImageUrl: normalizeString(
      payload.coverImageUrl ?? payload.cover_image_url,
    ),
    additionalMaterialsUrl: normalizeString(
      payload.additionalMaterialsUrl ?? payload.additional_materials_url,
    ),
    eventId: normalizeString(payload.eventId ?? payload.event_id) ?? undefined,
    trackIds: Array.isArray(rawTrackIds)
      ? rawTrackIds.filter((item): item is string => typeof item === "string")
      : undefined,
    videoUrl: normalizeString(payload.videoUrl ?? payload.video_url),
    artifacts: payload.artifacts,
    submissionAnswers:
      payload.submissionAnswers !== undefined
        ? payload.submissionAnswers
        : payload.submission_answers,
    submitted:
      typeof payload.submitted === "boolean" ? payload.submitted : undefined,
    extraProjectUrls: normalizeStringArray(
      payload.extraProjectUrls ?? payload.extra_project_urls,
    ),
    extraVideoUrls: normalizeStringArray(
      payload.extraVideoUrls ?? payload.extra_video_urls,
    ),
    extraMaterialsUrls: normalizeStringArray(
      payload.extraMaterialsUrls ?? payload.extra_materials_urls,
    ),
  });
}

function buildArtifactsFromInput(input: NormalizedProjectWriteInput) {
  const appendArtifacts = (
    artifacts: Array<{
      kind: "project_link" | "video_link" | "additional_material";
      label: string;
      url: string;
      sort_order: number;
      is_primary: boolean;
    }>,
    kind: "project_link" | "video_link" | "additional_material",
    primaryUrl: string | undefined,
    extraUrls: string[] | undefined,
    baseLabel: string,
  ) => {
    const urls = [primaryUrl || "", ...(extraUrls || [])]
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    urls.forEach((url, index) => {
      artifacts.push({
        kind,
        label: index === 0 ? baseLabel : `${baseLabel} ${index + 1}`,
        url,
        sort_order: index,
        is_primary: index === 0,
      });
    });
  };

  if (Array.isArray(input.artifacts)) {
    return normalizeProjectArtifacts(input.artifacts);
  }

  const fallbackArtifacts: Array<{
    kind: "project_link" | "video_link" | "additional_material";
    label: string;
    url: string;
    sort_order: number;
    is_primary: boolean;
  }> = [];

  appendArtifacts(
    fallbackArtifacts,
    "project_link",
    input.projectUrl,
    input.extraProjectUrls,
    "Project Link",
  );
  appendArtifacts(
    fallbackArtifacts,
    "video_link",
    input.videoUrl,
    input.extraVideoUrls,
    "Video Link",
  );
  appendArtifacts(
    fallbackArtifacts,
    "additional_material",
    input.additionalMaterialsUrl,
    input.extraMaterialsUrls,
    "Additional Material",
  );

  return normalizeProjectArtifacts(fallbackArtifacts);
}

async function validateProjectEventContext(
  supabase: ServiceSupabaseClient,
  eventId: string | null | undefined,
  trackIds: string[] | undefined,
) {
  if (!eventId) {
    return {
      event: null,
      configuredSubmissionFields: [],
      hasConfiguredSubmissionFields: false,
      validTrackIds: [] as string[],
    };
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      "event_id, event_name, submission_time_start, submission_time_cutoff",
    )
    .eq("event_id", eventId)
    .single()
    .overrideTypes<
      Pick<
        Database["public"]["Tables"]["events"]["Row"],
        "event_id" | "event_name" | "submission_time_start" | "submission_time_cutoff"
      >
    >();

  if (eventError) {
    return { error: "Failed to fetch event data", status: 500 as const };
  }

  if (!event) {
    return { error: "Event not found", status: 404 as const };
  }

  const now = new Date();
  if (event.submission_time_start) {
    const submissionStart = new Date(event.submission_time_start);
    if (now < submissionStart) {
      return {
        error: "Project submission has not started yet",
        status: 400 as const,
        details: {
          event_name: event.event_name,
          submission_start: event.submission_time_start,
        },
      };
    }
  }

  if (event.submission_time_cutoff) {
    const submissionCutoff = new Date(event.submission_time_cutoff);
    if (now > submissionCutoff) {
      return {
        error: "Project submission deadline has passed",
        status: 400 as const,
        details: {
          event_name: event.event_name,
          submission_cutoff: event.submission_time_cutoff,
        },
      };
    }
  }

  const { data: configuredSubmissionFields, error: fieldsError } =
    await supabase
    .from("event_submission_fields")
    .select("id, event_id, key, field_type, is_active")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .overrideTypes<
        Array<{
          id: string;
          event_id: string;
          key: string;
          field_type: string;
          is_active: boolean;
        }>
      >();

  if (fieldsError) {
    return {
      error: "Failed to fetch submission field configuration",
      status: 500 as const,
    };
  }

  let validTrackIds: string[] = [];
  if (trackIds !== undefined) {
    const { data: validTracks, error: trackError } = await supabase
      .from("event_tracks")
      .select("track_id")
      .eq("event_id", eventId)
      .in("track_id", trackIds)
      .overrideTypes<Array<{ track_id: string }>>();

    if (trackError) {
      return { error: "Failed to validate tracks", status: 500 as const };
    }

    validTrackIds = (validTracks || []).map((track) => track.track_id);
    const invalidTracks = trackIds.filter(
      (trackId) => !validTrackIds.includes(trackId),
    );
    if (invalidTracks.length > 0) {
      return {
        error: `Invalid track IDs: ${invalidTracks.join(", ")}`,
        status: 400 as const,
      };
    }
  }

  return {
    event,
    configuredSubmissionFields: configuredSubmissionFields || [],
    hasConfiguredSubmissionFields:
      (configuredSubmissionFields || []).length > 0,
    validTrackIds,
  };
}

async function maybeCreateContextusProject(
  supabase: ServiceSupabaseClient,
  options: {
    projectId: string;
    contextusProjectId: string | null | undefined;
    label: string | undefined;
    leadName: string | undefined;
    leadEmail: string | undefined;
    eventId: string | null | undefined;
    projectDescription: string | undefined;
    projectUrl: string | null;
    submitted: boolean | undefined;
  },
) {
  const {
    projectId,
    contextusProjectId,
    label,
    leadName,
    leadEmail,
    eventId,
    projectDescription,
    projectUrl,
    submitted,
  } = options;

  if (contextusProjectId || submitted === false) {
    return contextusProjectId || null;
  }

  try {
    const createdContextusProjectId = await createContextusProject({
      label: label || leadName || "Project",
      metadata: {
        mentor_mates_project_id: projectId,
        team_lead_name: leadName || "",
        team_lead_email: leadEmail || "",
        ...(eventId ? { event_id: eventId } : {}),
      },
      artifacts: projectUrl
        ? { type: "link", title: "Project Repository", url: projectUrl }
        : {
            type: "doc",
            title: projectDescription
              ? projectDescription.slice(0, 100)
              : "Project",
          },
    });

    await supabase.from("projects").update({
      contextus_project_id: createdContextusProjectId,
    }).eq("id", projectId);
    return createdContextusProjectId;
  } catch (error) {
    console.error("Error creating Contextus project:", error);
    return null;
  }
}

export async function saveProjectSubmission(
  supabase: ServiceSupabaseClient,
  options: {
    input: NormalizedProjectWriteInput;
    mode: "create" | "update";
    projectId?: string;
    defaultSubmitted?: boolean;
  },
) {
  const { input, mode } = options;
  const projectId = options.projectId || input.projectId;
  const submitted =
    input.submitted !== undefined ? input.submitted : options.defaultSubmitted;
  const normalizedArtifacts = buildArtifactsFromInput(input);
  const legacyFields = deriveLegacySubmissionFieldsFromArtifacts(
    normalizedArtifacts.length > 0
      ? normalizedArtifacts
      : buildArtifactsFromLegacy({
          project_url: input.projectUrl ?? null,
          video_url: input.videoUrl ?? null,
          additional_materials_url: input.additionalMaterialsUrl ?? null,
        }),
  );
  const hasArtifactsPayload =
    Array.isArray(input.artifacts) ||
    (input.extraProjectUrls?.length || 0) > 0 ||
    (input.extraVideoUrls?.length || 0) > 0 ||
    (input.extraMaterialsUrls?.length || 0) > 0;

  const parsedAnswers = Array.isArray(input.submissionAnswers)
    ? input.submissionAnswers
        .map((item) => submissionAnswerInputSchema.safeParse(item))
        .filter((item) => item.success)
        .map((item) => item.data)
    : [];

  let existingProjectEventId: string | null | undefined = input.eventId;
  if (mode === "update" && projectId) {
    const { data: existingProject, error } = await supabase
      .from("projects")
      .select("id, event_id, contextus_project_id")
      .eq("id", projectId)
      .single()
      .overrideTypes<
        Pick<
          Database["public"]["Tables"]["projects"]["Row"],
          "id" | "event_id" | "contextus_project_id"
        >
      >();
    if (error || !existingProject) {
      return { error: "Project not found", status: 404 as const };
    }

    existingProjectEventId = input.eventId ?? existingProject.event_id;
  }

  const validation = await validateProjectEventContext(
    supabase,
    existingProjectEventId ?? null,
    input.trackIds,
  );

  if ("error" in validation) {
    return {
      error: validation.error,
      status: validation.status,
      ...(validation.details ? validation.details : {}),
    };
  }

  const { configuredSubmissionFields, hasConfiguredSubmissionFields } =
    validation;

  const updateData: Database["public"]["Tables"]["projects"]["Update"] = {};
  if (input.projectName !== undefined)
    updateData.project_name = input.projectName;
  if (input.projectDescription !== undefined) {
    updateData.project_description = input.projectDescription;
  }
  if (input.projectUrl !== undefined) updateData.project_url = input.projectUrl;
  if (input.additionalMaterialsUrl !== undefined) {
    updateData.additional_materials_url = input.additionalMaterialsUrl;
  }
  if (input.coverImageUrl !== undefined)
    updateData.cover_image_url = input.coverImageUrl;
  if (input.leadName !== undefined) updateData.lead_name = input.leadName;
  if (input.leadEmail !== undefined) updateData.lead_email = input.leadEmail;
  if (input.teammates !== undefined) updateData.teammates = input.teammates;
  if (input.videoUrl !== undefined) updateData.video_url = input.videoUrl;
  if (input.eventId !== undefined) updateData.event_id = input.eventId;
  if (submitted !== undefined) {
    updateData.submitted = submitted;
    updateData.submitted_at = submitted ? new Date().toISOString() : null;
  }

  if (hasConfiguredSubmissionFields) {
    Object.assign(updateData, buildNullLegacyProjectPayload());
  } else if (mode === "create" || hasArtifactsPayload) {
    updateData.project_url = legacyFields.project_url;
    updateData.video_url = legacyFields.video_url;
    updateData.additional_materials_url = legacyFields.additional_materials_url;
  }

  if (
    mode === "update" &&
    Object.keys(updateData).length === 0 &&
    !hasArtifactsPayload &&
    input.submissionAnswers === undefined &&
    input.trackIds === undefined
  ) {
    return { message: "No updates provided", status: 200 as const };
  }

  let finalProjectId = projectId;
  if (mode === "create") {
    const createPayload: Database["public"]["Tables"]["projects"]["Insert"] = {
      ...updateData,
      lead_name: input.leadName ?? "",
      lead_email: input.leadEmail ?? null,
      teammates: input.teammates || [],
      event_id: input.eventId || null,
      submitted: submitted ?? true,
      submitted_at: submitted === false ? null : new Date().toISOString(),
    };

    const { data: createdProject, error } = await supabase.from("projects").insert(createPayload)
      .select("id, contextus_project_id")
      .single()
      .overrideTypes<
        Pick<
          Database["public"]["Tables"]["projects"]["Row"],
          "id" | "contextus_project_id"
        >
      >();
    if (error || !createdProject) {
      return { error: "Failed to create project", status: 500 as const };
    }

    finalProjectId = createdProject.id;
  } else {
    const { error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", finalProjectId!);
    if (error) {
      return { error: "Failed to update project", status: 500 as const };
    }
  }

  if (!finalProjectId) {
    return { error: "Project not found", status: 404 as const };
  }

  if (
    !hasConfiguredSubmissionFields &&
    (mode === "create" || hasArtifactsPayload)
  ) {
    const { error: deleteArtifactsError } = await supabase
      .from("project_artifacts")
      .delete()
      .eq(
      "project_id",
      finalProjectId,
    );

    if (deleteArtifactsError) {
      return {
        error: "Failed to update project artifacts",
        status: 500 as const,
      };
    }

    if (normalizedArtifacts.length > 0) {
      const artifactPayload: Database["public"]["Tables"]["project_artifacts"]["Insert"][] =
        normalizedArtifacts.map((artifact) => ({
          project_id: finalProjectId,
          kind: artifact.kind,
          label: artifact.label,
          url: artifact.url,
          sort_order: artifact.sort_order,
          is_primary: artifact.is_primary,
          metadata: (artifact.metadata ?? null) as Json | null,
        }));

      const { error: insertArtifactsError } = await supabase
        .from("project_artifacts")
        .insert(artifactPayload);
      if (insertArtifactsError) {
        return {
          error: "Failed to save project artifacts",
          status: 500 as const,
        };
      }
    }
  }

  if (input.submissionAnswers !== undefined || hasConfiguredSubmissionFields) {
    const fieldById = new Map(
      configuredSubmissionFields.map((field) => [
        field.id,
        field.field_type as
          | "short_text"
          | "long_text"
          | "url"
          | "multi_url"
          | "file"
          | "select"
          | "multi_select"
          | "checkbox",
      ]),
    );

    const answerFieldIds = [
      ...new Set(parsedAnswers.map((answer) => answer.eventSubmissionFieldId)),
    ];
    if (answerFieldIds.some((fieldId) => !fieldById.has(fieldId))) {
      return { error: "Invalid submission field IDs", status: 400 as const };
    }

    const normalizedAnswers = parsedAnswers
      .map((answer) => {
        const fieldType = fieldById.get(answer.eventSubmissionFieldId);
        if (!fieldType) return null;
        const coerced = coerceSubmissionAnswerValue(fieldType, answer.answer);
        if (coerced === null) return null;
        if (typeof coerced === "string" && coerced.length === 0) return null;
        if (Array.isArray(coerced) && coerced.length === 0) return null;

        return {
          project_id: finalProjectId,
          event_submission_field_id: answer.eventSubmissionFieldId,
          answer: coerced as Json,
        };
      })
      .filter(
        (
          answer,
        ): answer is Database["public"]["Tables"]["project_submission_answers"]["Insert"] =>
          Boolean(answer),
      );

    const { error: deleteAnswersError } = await supabase
      .from("project_submission_answers")
      .delete()
      .eq(
      "project_id",
      finalProjectId,
    );

    if (deleteAnswersError) {
      return {
        error: "Failed to update submission answers",
        status: 500 as const,
      };
    }

    if (normalizedAnswers.length > 0) {
      const { error: insertAnswersError } = await supabase
        .from("project_submission_answers")
        .insert(normalizedAnswers);
      if (insertAnswersError) {
        return {
          error: "Failed to save submission answers",
          status: 500 as const,
        };
      }
    }
  }

  if (existingProjectEventId && input.trackIds !== undefined) {
    const { error: deleteTracksError } = await supabase
      .from("project_tracks")
      .delete()
      .eq(
      "project_id",
      finalProjectId,
    );
    if (deleteTracksError) {
      return { error: "Failed to update project tracks", status: 500 as const };
    }

    if (input.trackIds.length > 0) {
      const { error: trackInsertError } = await supabase.from("project_tracks").insert(
        input.trackIds.map((trackId) => ({
          project_id: finalProjectId,
          track_id: trackId,
        })),
      );
      if (trackInsertError) {
        return {
          error: "Failed to create project track relationships",
          status: 500 as const,
        };
      }
    }
  }

  const { data: updatedProjectRow, error: updatedProjectError } = await supabase.from("projects").select(
    `
      id,
      project_name,
      lead_name,
      lead_email,
      project_description,
      teammates,
      project_url,
      video_url,
      additional_materials_url,
      cover_image_url,
      event_id,
      contextus_project_id,
      created_at,
      submitted,
      submitted_at,
      project_tracks (
        event_tracks (
          track_id,
          event_id,
          name,
          description,
          label,
          prize_amount,
          prize_description,
          scoring_criteria,
          created_at,
          updated_at
        )
      )
    `,
  )
    .eq("id", finalProjectId)
    .single()
    .overrideTypes<ProjectBaseRow>();

  if (updatedProjectError || !updatedProjectRow) {
    return { error: "Failed to fetch updated project", status: 500 as const };
  }

  const updatedProject = updatedProjectRow;

  const contextusProjectId = await maybeCreateContextusProject(supabase, {
    projectId: finalProjectId,
    contextusProjectId: updatedProject.contextus_project_id,
    label: input.projectName,
    leadName: input.leadName,
    leadEmail: input.leadEmail,
    eventId: existingProjectEventId ?? input.eventId,
    projectDescription: input.projectDescription,
    projectUrl: legacyFields.project_url,
    submitted,
  });

  const [fieldMap, answerMap, artifactMap] = await Promise.all([
    fetchSubmissionFieldsByEventIds(
      supabase,
      updatedProject.event_id ? [updatedProject.event_id as string] : [],
    ),
    fetchSubmissionAnswersByProjectIds(supabase, [finalProjectId]),
    fetchArtifactsByProjectIds(supabase, [finalProjectId]),
  ]);

  const [hydratedProject] = hydrateProjectsWithSubmissionData(
    [
      {
        ...updatedProject,
        contextus_project_id:
          contextusProjectId ||
          updatedProject.contextus_project_id,
      },
    ],
    fieldMap,
    answerMap,
    artifactMap,
  );

  return {
    status: 200 as const,
    project: hydratedProject,
  };
}
