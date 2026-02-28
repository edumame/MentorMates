import { supabase } from "@/lib/supabase";
import { Prize, Project } from "@/lib/types";
import { buildArtifactsFromLegacy } from "@/features/projects/utils/submission";

// TODO: This file is a mess and needs to be refactored to backend api logic.
/**
 * Fetches a project by its ID
 * @param projectId The ID of the project to fetch
 * @param includeEventName If true, fetches the event name from the events table
 * @param includePrizes If true, fetches the prizes won by this project
 * @returns The project data or null if not found
 */
export async function fetchProjectById(
  projectId: string,
  includeEventName: boolean = false,
  includePrizes: boolean = false
): Promise<Project | null> {
  if (!projectId) return null;

  try {
    // Fetch project data
    const { data, error } = await supabase
      .from("projects")
      .select(
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
      `
      )
      .eq("id", projectId)
      .single();

    if (error) {
      console.error("Error fetching project:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    const [{ data: artifactRows }, { data: answerRows }] = await Promise.all([
      supabase
        .from("project_artifacts")
        .select(
          "id, project_id, kind, label, url, sort_order, is_primary, metadata"
        )
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("project_submission_answers")
        .select("id, project_id, event_submission_field_id, answer")
        .eq("project_id", projectId),
    ]);

    const project: Project = {
      id: data.id,
      project_name: data.project_name,
      lead_name: data.lead_name,
      lead_email: data.lead_email,
      project_description: data.project_description,
      teammates: data.teammates,
      project_url: data.project_url,
      video_url: data.video_url,
      additional_materials_url: data.additional_materials_url,
      cover_image_url: data.cover_image_url,
      artifacts:
        artifactRows && artifactRows.length > 0
          ? artifactRows
          : buildArtifactsFromLegacy({
              project_url: data.project_url,
              video_url: data.video_url,
              additional_materials_url: data.additional_materials_url,
            }),
      submission_answers: (answerRows || []).map((answer) => ({
        id: answer.id,
        project_id: answer.project_id,
        event_submission_field_id: answer.event_submission_field_id,
        answer: answer.answer as string | string[],
      })),
      event_id: data.event_id,
      contextus_project_id: (data as unknown as { contextus_project_id?: string }).contextus_project_id,
      tracks:
        data.project_tracks
          ?.map((pt) => pt.event_tracks?.[0])
          .filter(Boolean) || [],
      track_ids:
        data.project_tracks
          ?.map((pt) => pt.event_tracks?.[0]?.track_id)
          .filter(Boolean) || [],
      created_at: data.created_at,
    };

    // Optionally fetch the event name
    if (includeEventName && data.event_id) {
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("event_name")
        .eq("event_id", data.event_id)
        .single();

      if (!eventError && eventData) {
        project.event_name = eventData.event_name;
      }
    }

    // Optionally fetch prizes won by this project
    if (includePrizes) {
      const { data: prizesData, error: prizesError } = await supabase
        .from("prize_winners")
        .select(
          `
          id,
          prize_id,
          prize(
            track_id,
            prize_amount,
            prize_description
          ),
          project_id
        `
        )
        .eq("project_id", projectId)
        .overrideTypes<
          Array<{
            id: string;
            prize_id: string;
            project_id: string;
            prize: {
              track_id: string;
              prize_amount: string;
              prize_description: string;
            };
          }>
        >();

      const flattenedPrizes = prizesData?.map((prize) => ({
        id: prize.id,
        track_id: prize.prize?.track_id,
        prize_amount: prize.prize?.prize_amount,
        prize_description: prize.prize?.prize_description,
        winning_project_id: prize.project_id,
      })) as Prize[];

      if (!prizesError && flattenedPrizes) {
        project.prizes_won = flattenedPrizes;
      }
    }

    return project;
  } catch (error) {
    console.error("Unexpected error fetching project:", error);
    return null;
  }
}
