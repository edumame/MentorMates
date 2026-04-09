import {
  fetchArtifactsByProjectIds,
  fetchSubmissionAnswersByProjectIds,
  fetchSubmissionFieldsByEventIds,
  hydrateProjectsWithSubmissionData,
  ProjectBaseRow,
} from "@/lib/projects/query";
import type { ServiceSupabaseClient } from "@/lib/supabase/service";

const PARTICIPANT_PROJECT_SELECT = `
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
`;

export async function listParticipantProjectsByEvent(
  supabase: ServiceSupabaseClient,
  eventId: string,
  userEmail: string,
) {
  const [
    { data: leadProjects, error: leadError },
    { data: teamProjects, error: teamError },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(PARTICIPANT_PROJECT_SELECT)
      .eq("lead_email", userEmail)
      .eq("event_id", eventId)
      .overrideTypes<ProjectBaseRow[]>(),
    supabase
      .from("projects")
      .select(PARTICIPANT_PROJECT_SELECT)
      .contains("teammates", [userEmail])
      .eq("event_id", eventId)
      .overrideTypes<ProjectBaseRow[]>(),
  ]);

  if (leadError || teamError) {
    throw leadError || teamError;
  }

  const uniqueProjects = Array.from(
    new Map(
      [...(leadProjects || []), ...(teamProjects || [])].map((project) => [
        project.id,
        project,
      ]),
    ).values(),
  ).sort((a, b) => {
    const aCreatedAt = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreatedAt = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bCreatedAt - aCreatedAt;
  });

  const [fieldMap, answerMap, artifactMap] = await Promise.all([
    fetchSubmissionFieldsByEventIds(supabase, [eventId]),
    fetchSubmissionAnswersByProjectIds(
      supabase,
      uniqueProjects.map((project) => project.id),
    ),
    fetchArtifactsByProjectIds(
      supabase,
      uniqueProjects.map((project) => project.id),
    ),
  ]);

  return hydrateProjectsWithSubmissionData(
    uniqueProjects,
    fieldMap,
    answerMap,
    artifactMap,
  );
}
