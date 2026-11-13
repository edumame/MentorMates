import { z } from "zod";
import { getTeamEmails } from "@/lib/projects/membership";
import type { Database, Json } from "@/lib/database.types";
import {
  createSupabaseServiceClient,
  type ServiceSupabaseClient,
} from "@/lib/supabase/service";
import { createContextusProject } from "@/lib/integrations/contextus";
import {
  buildArtifactsFromLegacy,
  coerceSubmissionAnswerValue,
  deriveLegacySubmissionFieldsFromArtifacts,
  normalizeProjectArtifacts,
  submissionAnswerInputSchema,
} from "@/features/projects/utils/submission";
import {
  buildNullLegacyProjectPayload,
  buildSubmissionValuesFromProject,
  findMissingRequiredSubmissionField,
} from "@/features/projects/utils/effectiveSubmission";
import type { EventSubmissionField, Project } from "@/lib/types";
import {
  fetchArtifactsByProjectIds,
  fetchSubmissionAnswersByProjectIds,
  fetchSubmissionFieldsByEventIds,
  hydrateProjectsWithSubmissionData,
  type ProjectBaseRow,
} from "@/lib/projects/query";
import { applyTeammateChanges } from "@/lib/projects/teammates";

const projectWriteSchema = z.object({
  projectId: z.string().uuid().optional(),
  projectName: z.string().max(200).optional(),
  leadName: z.string().max(200).optional(),
  leadEmail: z.string().email().max(320).optional(),
  projectDescription: z.string().max(20000).optional(),
  teammates: z.array(z.string()).optional(),
  addTeammates: z.array(z.string()).optional(),
  removeTeammates: z.array(z.string()).optional(),
  projectUrl: z.string().optional(),
  coverImageUrl: z.string().optional(),
  additionalMaterialsUrl: z.string().optional(),
  eventId: z.string().uuid().nullable().optional(),
  isPrivate: z.boolean().optional(),
  trackIds: z.array(z.string().uuid()).optional(),
  videoUrl: z.string().optional(),
  artifacts: z.unknown().optional(),
  submissionAnswers: z.unknown().optional(),
  submitted: z.boolean().optional(),
  extraProjectUrls: z.array(z.string()).optional(),
  extraVideoUrls: z.array(z.string()).optional(),
  extraMaterialsUrls: z.array(z.string()).optional(),
});


/**
 * Database guards on projects (lane A1): moving a project to another event is
 * refused once it has scores/prizes/votes or a round advancement (23514) or
 * when the target event was not joined (42501). Surface those as client errors instead of a 500.
 */
export function mapProjectUpdateError(error: { code?: string | null; message?: string | null }) {
  if (error.code === "23514") {
    return {
      error:
        "This project can't be moved to another event because it already has scores, prizes, votes or a round advancement.",
      status: 400 as const,
    };
  }
  if (error.code === "42501") {
    return {
      error: "You can only move a project to an event you have joined.",
      status: 403 as const,
    };
  }
  return null;
}

export type NormalizedProjectWriteInput = z.infer<typeof projectWriteSchema>;

type ConfiguredSubmissionField = {
  key: string;
  fieldType:
    | "short_text"
    | "long_text"
    | "url"
    | "multi_url"
    | "file"
    | "multi_file"
    | "select"
    | "multi_select"
    | "checkbox";
};

type NormalizedSubmissionAnswerPayload = Pick<
  Database["public"]["Tables"]["project_submission_answers"]["Insert"],
  "event_submission_field_id" | "answer"
>;

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
    addTeammates: normalizeStringArray(payload.addTeammates),
    removeTeammates: normalizeStringArray(payload.removeTeammates),
    projectUrl: normalizeString(payload.projectUrl ?? payload.project_url),
    coverImageUrl: normalizeString(
      payload.coverImageUrl ?? payload.cover_image_url,
    ),
    additionalMaterialsUrl: normalizeString(
      payload.additionalMaterialsUrl ?? payload.additional_materials_url,
    ),
    eventId: normalizeString(payload.eventId ?? payload.event_id) ?? undefined,
    isPrivate:
      typeof (payload.isPrivate ?? payload.is_private ?? payload.private) ===
      "boolean"
        ? Boolean(payload.isPrivate ?? payload.is_private ?? payload.private)
        : undefined,
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

function buildConfiguredSubmissionFieldMap(
  configuredSubmissionFields: Array<{
    id: string;
    key: string;
    field_type: string;
  }>,
) {
  return new Map<string, ConfiguredSubmissionField>(
    configuredSubmissionFields.map((field) => [
      field.id,
      {
        key: field.key,
        fieldType: field.field_type as ConfiguredSubmissionField["fieldType"],
      },
    ]),
  );
}

function deriveLockedProjectFieldUpdates(
  input: NormalizedProjectWriteInput,
  parsedAnswers: Array<z.infer<typeof submissionAnswerInputSchema>>,
  fieldById: Map<string, ConfiguredSubmissionField>,
): Pick<
  Database["public"]["Tables"]["projects"]["Update"],
  "project_name" | "project_description"
> {
  const lockedFieldUpdates: Pick<
    Database["public"]["Tables"]["projects"]["Update"],
    "project_name" | "project_description"
  > = {};

  for (const answer of parsedAnswers) {
    const field = fieldById.get(answer.eventSubmissionFieldId);
    if (!field) continue;

    if (
      field.key !== "project_name" &&
      field.key !== "project_description"
    ) {
      continue;
    }

    const coerced = coerceSubmissionAnswerValue(field.fieldType, answer.answer);
    if (coerced === null || Array.isArray(coerced)) {
      continue;
    }

    if (field.key === "project_name" && input.projectName === undefined) {
      lockedFieldUpdates.project_name = coerced;
    }

    if (
      field.key === "project_description" &&
      input.projectDescription === undefined
    ) {
      lockedFieldUpdates.project_description = coerced;
    }
  }

  return lockedFieldUpdates;
}

function normalizeSubmissionAnswersForPersistence(
  parsedAnswers: Array<z.infer<typeof submissionAnswerInputSchema>>,
  fieldById: Map<string, ConfiguredSubmissionField>,
):
  | {
      normalizedAnswers: NormalizedSubmissionAnswerPayload[];
    }
  | {
      error: string;
      code: "submission_field_mismatch";
      status: 400;
    } {
  const answerFieldIds = [
    ...new Set(parsedAnswers.map((answer) => answer.eventSubmissionFieldId)),
  ];

  if (answerFieldIds.some((fieldId) => !fieldById.has(fieldId))) {
    return {
      error:
        "This project's saved submission fields no longer match the event's current submission form.",
      code: "submission_field_mismatch",
      status: 400,
    };
  }

  return {
    normalizedAnswers: parsedAnswers
      .map((answer) => {
        const field = fieldById.get(answer.eventSubmissionFieldId);
        if (!field) return null;

        const coerced = coerceSubmissionAnswerValue(
          field.fieldType,
          answer.answer,
        );

        if (coerced === null) return null;
        if (typeof coerced === "string" && coerced.length === 0) return null;
        if (Array.isArray(coerced) && coerced.length === 0) return null;

        return {
          event_submission_field_id: answer.eventSubmissionFieldId,
          answer: coerced as Json,
        };
      })
      .filter(
        (
          answer,
        ): answer is NormalizedSubmissionAnswerPayload => Boolean(answer),
      ),
  };
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

/**
 * Server-side-only overrides for `saveProjectSubmission`.
 *
 * These must never be derived from request input. Routes pass one of the
 * exported constants below; the default (no overrides) is the participant path.
 */
export type ProjectSubmissionOverrides = {
  /**
   * Skip the `submission_time_cutoff` check. Only for organizer/admin-gated
   * flows such as submitting on behalf of a participant who missed the deadline.
   * The submission start check still applies.
   */
  allowAfterDeadline?: boolean;
};

export const ORGANIZER_ON_BEHALF_SUBMISSION_OVERRIDES: Readonly<ProjectSubmissionOverrides> =
  Object.freeze({ allowAfterDeadline: true });

// Round advancements stay keyed to the event they were made in, so moving a
// project away from them silently detaches it from that event's judging.
// Scores, prize winners and votes are already refused by the
// guard_project_event_change trigger (mapped by mapProjectUpdateError), and
// stale assignments are dropped by cleanup_project_after_event_change
// (migration 202611080105), so they are not re-checked here. The caller may be
// a lead, who cannot read these tables under RLS, so the lookups use the
// service client and a failed lookup blocks the move.
const JUDGING_RECORD_TABLES = ["project_round_advancements"] as const;

const EVENT_MOVE_CHECK_FAILED = {
  error: "Failed to verify whether this project can change events",
  status: 500 as const,
};

async function validateProjectCanLeaveEvent(project: {
  id: string;
  event_id: string;
  submitted: boolean | null;
}) {
  const blocked = (reason: string) => ({
    error: `This project can't move to another event because ${reason}. Contact an organizer of its current event.`,
    code: "project_event_move_blocked" as const,
    status: 409 as const,
  });

  try {
    const serviceClient = createSupabaseServiceClient();

    const { data: currentEvent, error: eventError } = await serviceClient
      .from("events")
      .select("submission_time_cutoff")
      .eq("event_id", project.event_id)
      .maybeSingle();

    if (eventError) {
      console.error("[submit] fetch current event failed", {
        projectId: project.id,
        error: eventError,
      });
      return EVENT_MOVE_CHECK_FAILED;
    }

    const judgingLookups = await Promise.all(
      JUDGING_RECORD_TABLES.map((table) =>
        serviceClient
          .from(table)
          .select("project_id")
          .eq("project_id", project.id)
          .limit(1),
      ),
    );

    const failedLookup = judgingLookups.find((lookup) => lookup.error);
    if (failedLookup) {
      console.error("[submit] fetch judging records failed", {
        projectId: project.id,
        error: failedLookup.error,
      });
      return EVENT_MOVE_CHECK_FAILED;
    }

    if (judgingLookups.some((lookup) => (lookup.data?.length ?? 0) > 0)) {
      return blocked("it already has judging records");
    }

    // A draft was never entered into the closed event, so it may still go to
    // another one. Legacy rows with a null flag count as submitted.
    const cutoff = currentEvent?.submission_time_cutoff;
    if (
      project.submitted !== false &&
      cutoff &&
      new Date() > new Date(cutoff)
    ) {
      return blocked("the submission deadline for its current event has passed");
    }

    return null;
  } catch (error) {
    console.error("[submit] event move check failed", {
      projectId: project.id,
      error,
    });
    return EVENT_MOVE_CHECK_FAILED;
  }
}

const TEAM_READ_FAILED = {
  error: "Could not load the current team. Please try again.",
  status: 503 as const,
};

/**
 * Stored teammates of a project, for applying add/remove changes on top of.
 * Uses the service client because projects.teammates is not readable by
 * client roles (202611080505); the caller must already have checked that the
 * user may edit the project. Fails closed: guessing an empty team here would
 * drop every existing teammate on save.
 */
async function fetchStoredTeammates(
  projectId: string,
): Promise<{ teammates: string[] | null } | typeof TEAM_READ_FAILED> {
  try {
    const { data, error } = await createSupabaseServiceClient()
      .from("projects")
      .select("teammates")
      .eq("id", projectId)
      .single();
    if (error || !data) {
      console.error("[submit] fetch stored teammates failed", {
        projectId,
        error,
      });
      return TEAM_READ_FAILED;
    }
    return { teammates: data.teammates };
  } catch (error) {
    console.error("[submit] fetch stored teammates failed", {
      projectId,
      error,
    });
    return TEAM_READ_FAILED;
  }
}

async function validateProjectEventContext(
  supabase: ServiceSupabaseClient,
  eventId: string | null | undefined,
  trackIds: string[] | undefined,
  overrides: ProjectSubmissionOverrides = {},
) {
  if (!eventId) {
    return {
      event: null,
      isPastCutoff: false,
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
    console.error("[submit] fetch event failed", { eventId, error: eventError });
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

  const isPastCutoff = Boolean(
    event.submission_time_cutoff &&
      now > new Date(event.submission_time_cutoff),
  );
  if (isPastCutoff && overrides.allowAfterDeadline !== true) {
    return {
      error: "Project submission deadline has passed",
      status: 400 as const,
      details: {
        event_name: event.event_name,
        submission_cutoff: event.submission_time_cutoff,
      },
    };
  }

  const { data: configuredSubmissionFields, error: fieldsError } =
    await supabase
    .from("event_submission_fields")
    .select("id, event_id, key, label, field_type, required, is_active")
      .eq("event_id", eventId)
      .eq("is_active", true)
      // Multi-entry fields live in project_field_entries, not the
      // single-answer submission flow.
      .eq("allows_multiple_entries", false)
      .order("sort_order", { ascending: true })
      .overrideTypes<
        Array<{
          id: string;
          event_id: string;
          key: string;
          label: string;
          field_type: EventSubmissionField["field_type"];
          required: boolean;
          is_active: boolean;
        }>
      >();

  if (fieldsError) {
    console.error("[submit] fetch submission fields failed", {
      eventId,
      error: fieldsError,
    });
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
      console.error("[submit] validate tracks failed", {
        eventId,
        trackIds,
        error: trackError,
      });
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
    isPastCutoff,
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
    overrides?: ProjectSubmissionOverrides;
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

  const hasSubmissionAnswersPayload = Array.isArray(input.submissionAnswers);
  const parsedAnswers = Array.isArray(input.submissionAnswers)
    ? input.submissionAnswers
        .map((item) => submissionAnswerInputSchema.safeParse(item))
        .filter((item) => item.success)
        .map((item) => item.data)
    : [];

  let existingProjectEventId: string | null | undefined = input.eventId;
  let existingProjectName: string | null = null;
  let existingProjectDescription: string | null = null;
  let existingLegacySubmissionFields: Partial<
    Pick<
      Database["public"]["Tables"]["projects"]["Row"],
      | "project_url"
      | "video_url"
      | "additional_materials_url"
      | "cover_image_url"
    >
  > = {};
  let isMovingToAnotherEvent = false;
  let existingProjectIsDraft = false;
  if (mode === "update" && projectId) {
    // `supabase` is often the caller's session client, which cannot read
    // projects.lead_email / teammates (202611080505). Selecting either column
    // here fails the whole query with 42501 and breaks every save; team
    // emails are read separately below, only when a team change needs them.
    const { data: existingProject, error } = await supabase
      .from("projects")
      .select(
        "id, event_id, contextus_project_id, project_name, project_description, project_url, video_url, additional_materials_url, cover_image_url, submitted",
      )
      .eq("id", projectId)
      .single()
      .overrideTypes<
        Pick<
          Database["public"]["Tables"]["projects"]["Row"],
          | "id"
          | "event_id"
          | "contextus_project_id"
          | "project_name"
          | "project_description"
          | "project_url"
          | "video_url"
          | "additional_materials_url"
          | "cover_image_url"
          | "submitted"
        >
      >();
    if (error || !existingProject) {
      console.error("[submit] fetch existing project failed", {
        projectId,
        error,
      });
      return { error: "Project not found", status: 404 as const };
    }

    const currentEventId = existingProject.event_id;
    if (
      currentEventId &&
      input.eventId !== undefined &&
      input.eventId !== currentEventId
    ) {
      const moveBlocked = await validateProjectCanLeaveEvent({
        ...existingProject,
        event_id: currentEventId,
      });
      if (moveBlocked) return moveBlocked;
    }

    existingProjectEventId = input.eventId ?? existingProject.event_id;
    existingProjectName = existingProject.project_name ?? null;
    existingProjectDescription = existingProject.project_description ?? null;
    existingLegacySubmissionFields = {
      project_url: existingProject.project_url,
      video_url: existingProject.video_url,
      additional_materials_url: existingProject.additional_materials_url,
      cover_image_url: existingProject.cover_image_url,
    };
    isMovingToAnotherEvent =
      input.eventId !== undefined &&
      input.eventId !== existingProject.event_id;
    existingProjectIsDraft = existingProject.submitted === false;
  }

  const validation = await validateProjectEventContext(
    supabase,
    existingProjectEventId ?? null,
    input.trackIds,
    options.overrides,
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
  const configuredFieldById = buildConfiguredSubmissionFieldMap(
    configuredSubmissionFields,
  );
  const lockedProjectFieldUpdates = deriveLockedProjectFieldUpdates(
    input,
    parsedAnswers,
    configuredFieldById,
  );
  const normalizedSubmissionAnswersResult =
    normalizeSubmissionAnswersForPersistence(
      parsedAnswers,
      configuredFieldById,
    );

  if ("error" in normalizedSubmissionAnswersResult) {
    return normalizedSubmissionAnswersResult;
  }

  const normalizedSubmissionAnswers =
    normalizedSubmissionAnswersResult.normalizedAnswers;

  const updateData: Database["public"]["Tables"]["projects"]["Update"] = {};
  if (input.projectName !== undefined)
    updateData.project_name = input.projectName;
  else if (lockedProjectFieldUpdates.project_name !== undefined) {
    updateData.project_name = lockedProjectFieldUpdates.project_name;
  }
  if (input.projectDescription !== undefined) {
    updateData.project_description = input.projectDescription;
  } else if (lockedProjectFieldUpdates.project_description !== undefined) {
    updateData.project_description = lockedProjectFieldUpdates.project_description;
  }
  if (input.projectUrl !== undefined) updateData.project_url = input.projectUrl;
  if (input.additionalMaterialsUrl !== undefined) {
    updateData.additional_materials_url = input.additionalMaterialsUrl;
  }
  if (input.coverImageUrl !== undefined)
    updateData.cover_image_url = input.coverImageUrl;
  if (input.leadName !== undefined) updateData.lead_name = input.leadName;
  // lead_email is set on create only. It decides who owns the project, and any
  // member can reach this update, so an update must never reassign the lead.
  if (input.teammates !== undefined) {
    updateData.teammates = input.teammates;
  } else if (input.addTeammates?.length || input.removeTeammates?.length) {
    // A new project has no stored team; an update must start from the stored
    // one, or a partial change would wipe everyone else on the team.
    let storedTeammates: string[] | null = null;
    if (mode === "update" && projectId) {
      const stored = await fetchStoredTeammates(projectId);
      if ("error" in stored) return stored;
      storedTeammates = stored.teammates;
    }
    updateData.teammates = applyTeammateChanges(storedTeammates, {
      add: input.addTeammates,
      remove: input.removeTeammates,
    });
  }
  if (input.videoUrl !== undefined) updateData.video_url = input.videoUrl;
  if (input.eventId !== undefined) updateData.event_id = input.eventId;
  if (input.isPrivate !== undefined) updateData.private = input.isPrivate;
  if (submitted !== undefined) {
    updateData.submitted = submitted;
    updateData.submitted_at = submitted ? new Date().toISOString() : null;
  }

  const isNonEmptyString = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0;

  // Drafts created by POST /api/projects start with no name or description, so
  // the locked fields only apply once the saved project is submitted.
  const resultingSubmitted = submitted ?? !existingProjectIsDraft;
  const staysDraft = mode === "update" && !resultingSubmitted;

  const lockedFieldErrors: string[] = [];
  const finalProjectName =
    updateData.project_name !== undefined
      ? updateData.project_name
      : existingProjectName;
  const finalProjectDescription =
    updateData.project_description !== undefined
      ? updateData.project_description
      : existingProjectDescription;

  if (!staysDraft && !isNonEmptyString(finalProjectName)) {
    lockedFieldErrors.push("project_name");
  }
  if (!staysDraft && !isNonEmptyString(finalProjectDescription)) {
    lockedFieldErrors.push("project_description");
  }

  if (lockedFieldErrors.length > 0) {
    return {
      error: `Project submission requires the locked fields: ${lockedFieldErrors.join(", ")}.`,
      code: "locked_field_missing" as const,
      status: 400 as const,
    };
  }

  // An update that omits answers (a bare submit, a settings change) keeps the
  // saved submission. Answers are only replaced when the request carries them,
  // or when the project moves to an event whose fields they don't belong to.
  const replacesConfiguredSubmission =
    hasConfiguredSubmissionFields &&
    (mode === "create" || hasSubmissionAnswersPayload || isMovingToAnotherEvent);

  if (hasConfiguredSubmissionFields) {
    if (replacesConfiguredSubmission) {
      const {
        project_name: _ignoredProjectName,
        project_description: _ignoredProjectDescription,
        ...legacySubmissionFieldReset
      } = buildNullLegacyProjectPayload();
      Object.assign(updateData, legacySubmissionFieldReset);
    }
  } else if (mode === "create" || hasArtifactsPayload) {
    updateData.project_url = legacyFields.project_url;
    updateData.video_url = legacyFields.video_url;
    updateData.additional_materials_url = legacyFields.additional_materials_url;
  }

  if (submitted === true && hasConfiguredSubmissionFields) {
    const answersToValidate = replacesConfiguredSubmission
      ? normalizedSubmissionAnswers
      : (await fetchSubmissionAnswersByProjectIds(supabase, [projectId!])).get(
          projectId!,
        );
    const missingRequiredField = findMissingRequiredSubmissionField(
      configuredSubmissionFields,
      buildSubmissionValuesFromProject(
        {
          ...existingLegacySubmissionFields,
          project_name: finalProjectName,
          project_description: finalProjectDescription,
          ...updateData,
          submission_answers: answersToValidate,
        } as Partial<Project>,
        configuredSubmissionFields,
      ),
    );

    if (missingRequiredField) {
      return {
        error: `"${missingRequiredField.label}" is required`,
        code: "required_field_missing" as const,
        status: 400 as const,
      };
    }
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
      teammates: updateData.teammates ?? [],
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
      console.error("Failed to create project:", error);
      return { error: "Failed to create project", status: 500 as const };
    }

    finalProjectId = createdProject.id;
  } else {
    const { data: updatedRows, error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", finalProjectId!)
      .select("id");
    if (error) {
      const mapped = mapProjectUpdateError(error);
      if (mapped) return mapped;
      console.error("[submit] update project failed", {
        projectId: finalProjectId,
        error,
      });
      return { error: "Failed to update project", status: 500 as const };
    }
    // RLS filters an unauthorised UPDATE to zero rows without an error; that
    // must not be reported as a successful save (PUB-011).
    if (!updatedRows || updatedRows.length === 0) {
      return {
        error: "You don't have permission to edit this project",
        status: 403 as const,
      };
    }
  }

  if (!finalProjectId) {
    console.error("[submit] finalProjectId missing after create/update", {
      mode,
      projectId,
    });
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

  if (hasSubmissionAnswersPayload || replacesConfiguredSubmission) {
    const { error: deleteAnswersError } = await supabase
      .from("project_submission_answers")
      .delete()
      .eq(
      "project_id",
      finalProjectId,
    );

    if (deleteAnswersError) {
      console.error("[submit] delete prior submission answers failed", {
        projectId: finalProjectId,
        error: deleteAnswersError,
      });
      return {
        error: "Failed to update submission answers",
        status: 500 as const,
      };
    }

    if (normalizedSubmissionAnswers.length > 0) {
      const { error: insertAnswersError } = await supabase
        .from("project_submission_answers")
        .insert(
          normalizedSubmissionAnswers.map((answer) => ({
            project_id: finalProjectId,
            ...answer,
          })),
        );
      if (insertAnswersError) {
        console.error("[submit] insert submission answers failed", {
          projectId: finalProjectId,
          answerCount: normalizedSubmissionAnswers.length,
          error: insertAnswersError,
        });
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
      console.error("[submit] delete project tracks failed", {
        projectId: finalProjectId,
        error: deleteTracksError,
      });
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
        console.error("[submit] insert project tracks failed", {
          projectId: finalProjectId,
          trackIds: input.trackIds,
          error: trackInsertError,
        });
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
      project_description,
      project_url,
      video_url,
      additional_materials_url,
      cover_image_url,
      event_id,
      contextus_project_id,
      private,
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
    console.error("[submit] fetch updated project failed", {
      projectId: finalProjectId,
      error: updatedProjectError,
    });
    return { error: "Failed to fetch updated project", status: 500 as const };
  }

  // Team emails are not client-readable columns; the saver is a team member
  // or organizer, so project_team_emails returns them.
  const savedTeamEmails = (await getTeamEmails(supabase, [finalProjectId])).get(finalProjectId);
  const updatedProject: ProjectBaseRow = {
    ...updatedProjectRow,
    lead_email: savedTeamEmails?.lead_email ?? null,
    teammates: savedTeamEmails?.teammates ?? null,
  };

  const contextusProjectId = await maybeCreateContextusProject(supabase, {
    projectId: finalProjectId,
    contextusProjectId: updatedProject.contextus_project_id,
    // Publishing a draft can send only { projectId, submitted }, so read these
    // from the saved row rather than the request.
    label: updatedProject.project_name ?? undefined,
    leadName: updatedProject.lead_name ?? undefined,
    leadEmail: updatedProject.lead_email ?? undefined,
    eventId: existingProjectEventId ?? input.eventId,
    projectDescription: updatedProject.project_description ?? undefined,
    projectUrl: legacyFields.project_url ?? updatedProject.project_url ?? null,
    submitted: staysDraft ? false : submitted,
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
    // True only when an override let this write through after the event's
    // submission cutoff (e.g. an organizer submitting on behalf of a participant).
    submittedAfterDeadline: validation.isPastCutoff,
  };
}
