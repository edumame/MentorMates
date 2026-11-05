import {
  EventSubmissionField,
  EventTrack,
  Project,
  ProjectSubmissionAnswer,
} from "@/lib/types";
import type { Database } from "@/lib/database.types";
import type { ServiceSupabaseClient } from "@/lib/supabase/service";
import { buildArtifactsFromLegacy } from "@/features/projects/utils/submission";
import { applyEffectiveSubmissionToProject } from "@/features/projects/utils/effectiveSubmission";

export type ProjectArtifactRow = {
  project_id: Database["public"]["Tables"]["project_artifacts"]["Row"]["project_id"];
  id?: Database["public"]["Tables"]["project_artifacts"]["Row"]["id"];
  kind: "project_link" | "video_link" | "additional_material";
  label: Database["public"]["Tables"]["project_artifacts"]["Row"]["label"];
  url: Database["public"]["Tables"]["project_artifacts"]["Row"]["url"];
  sort_order: Database["public"]["Tables"]["project_artifacts"]["Row"]["sort_order"];
  is_primary: Database["public"]["Tables"]["project_artifacts"]["Row"]["is_primary"];
  metadata?: Record<string, unknown> | null;
};

export type ProjectBaseRow = {
  id: string;
  project_name: string | null;
  lead_name: string | null;
  lead_email: string | null;
  private?: boolean | null;
  project_description: string | null;
  teammates: string[] | null;
  project_url: string | null;
  video_url: string | null;
  additional_materials_url: string | null;
  cover_image_url: string | null;
  event_id: string | null;
  contextus_project_id?: string | null;
  created_at: string | null;
  submitted?: boolean | null;
  submitted_at?: string | null;
  project_tracks?: Array<{ event_tracks: EventTrack | null }> | null;
};

const PAGE_SIZE = 1000;

/**
 * Reads every page of a query. PostgREST silently caps each response at its
 * `max_rows` setting and still reports success, so an unpaged read can return
 * partial data. `fetchPage` must use a stable order and request an exact count;
 * the count is what ends the loop, so a cap below PAGE_SIZE cannot end it early.
 * Throws on a failed read so callers cannot mistake it for "no rows".
 */
async function fetchAllPages<Row>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: Row[] | null;
    error: unknown;
    count: number | null;
  }>,
) {
  const rows: Row[] = [];

  while (true) {
    const { data, error, count } = await fetchPage(
      rows.length,
      rows.length + PAGE_SIZE - 1,
    );

    if (error) {
      throw error;
    }

    rows.push(...(data ?? []));

    if (!data?.length || (count !== null && rows.length >= count)) {
      return rows;
    }
  }
}

export async function fetchSubmissionFieldsByEventIds(
  supabase: ServiceSupabaseClient,
  eventIds: string[],
) {
  const uniqueEventIds = Array.from(new Set(eventIds.filter(Boolean)));
  if (uniqueEventIds.length === 0) {
    return new Map<string, EventSubmissionField[]>();
  }

  const { data, error } = await supabase
    .from("event_submission_fields")
    .select("*")
    .in("event_id", uniqueEventIds)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .overrideTypes<EventSubmissionField[]>();

  if (error || !data) {
    return new Map<string, EventSubmissionField[]>();
  }

  const map = new Map<string, EventSubmissionField[]>();
  for (const row of data) {
    const existing = map.get(row.event_id) || [];
    existing.push(row);
    map.set(row.event_id, existing);
  }

  return map;
}

export async function fetchSubmissionAnswersByProjectIds(
  supabase: ServiceSupabaseClient,
  projectIds: string[],
) {
  const uniqueProjectIds = Array.from(new Set(projectIds.filter(Boolean)));
  if (uniqueProjectIds.length === 0) {
    return new Map<string, ProjectSubmissionAnswer[]>();
  }

  const data = await fetchAllPages((from, to) =>
    supabase
      .from("project_submission_answers")
      .select("id, project_id, event_submission_field_id, answer", {
        count: "exact",
      })
      .in("project_id", uniqueProjectIds)
      .order("id", { ascending: true })
      .range(from, to)
      .overrideTypes<ProjectSubmissionAnswer[]>(),
  );

  const map = new Map<string, ProjectSubmissionAnswer[]>();
  for (const row of data) {
    const existing = map.get(row.project_id) || [];
    existing.push(row);
    map.set(row.project_id, existing);
  }

  return map;
}

export async function fetchArtifactsByProjectIds(
  supabase: ServiceSupabaseClient,
  projectIds: string[],
) {
  const uniqueProjectIds = Array.from(new Set(projectIds.filter(Boolean)));
  if (uniqueProjectIds.length === 0) {
    return new Map<string, ProjectArtifactRow[]>();
  }

  const data = await fetchAllPages((from, to) =>
    supabase
      .from("project_artifacts")
      .select(
        "id, project_id, kind, label, url, sort_order, is_primary, metadata",
        { count: "exact" },
      )
      .in("project_id", uniqueProjectIds)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
      .overrideTypes<ProjectArtifactRow[]>(),
  );

  const map = new Map<string, ProjectArtifactRow[]>();
  for (const row of data) {
    const existing = map.get(row.project_id) || [];
    existing.push(row);
    map.set(row.project_id, existing);
  }

  return map;
}

export function hydrateProjectsWithSubmissionData(
  projectRows: ProjectBaseRow[],
  fieldMap: Map<string, EventSubmissionField[]>,
  answerMap: Map<string, ProjectSubmissionAnswer[]>,
  artifactMap: Map<string, ProjectArtifactRow[]>,
) {
  return projectRows.map((project) =>
    applyEffectiveSubmissionToProject(
      {
        id: project.id,
        project_name: project.project_name,
        lead_name: project.lead_name || "",
        lead_email: project.lead_email,
        is_private: Boolean(project.private),
        project_description: project.project_description,
        teammates: project.teammates,
        project_url: project.project_url,
        video_url: project.video_url,
        additional_materials_url: project.additional_materials_url,
        cover_image_url: project.cover_image_url,
        event_id: project.event_id,
        contextus_project_id: project.contextus_project_id,
        submitted: project.submitted ?? undefined,
        submitted_at: project.submitted_at ?? undefined,
        tracks:
          project.project_tracks
            ?.map((projectTrack) => projectTrack.event_tracks)
            .filter((track): track is EventTrack => Boolean(track)) || [],
        track_ids:
          project.project_tracks
            ?.map((projectTrack) => projectTrack.event_tracks?.track_id)
            .filter((trackId): trackId is string => Boolean(trackId)) || [],
        created_at: project.created_at,
      } as Project,
      fieldMap.get(project.event_id || "") || [],
      answerMap.get(project.id),
      artifactMap.get(project.id) ||
        buildArtifactsFromLegacy({
          project_url: project.project_url,
          video_url: project.video_url,
          additional_materials_url: project.additional_materials_url,
        }),
    ),
  );
}
