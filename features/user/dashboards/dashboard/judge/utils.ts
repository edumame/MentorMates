import { Project } from "@/lib/types";

export function isProjectFullyScored(
  project: Pick<Project, "id" | "track_ids">,
  scoredProjects: Map<string, Set<string>>
): boolean {
  if (project.track_ids.length === 0) {
    return false;
  }

  const scoredTrackIds = scoredProjects.get(project.id);
  if (!scoredTrackIds) {
    return false;
  }

  return project.track_ids.every((trackId) => scoredTrackIds.has(trackId));
}

/**
 * Group a judge's score rows by project and track. project_scores rows outlive
 * project_tracks membership, so rows for a track the project has left are
 * skipped: they must not count towards progress or averages.
 */
export function buildJudgeScoreMaps(
  scoreRows: Array<{
    project_id: string;
    track_id: string;
    scores: Record<string, number> | null;
  }>,
  projects: Array<Pick<Project, "id" | "track_ids">>
) {
  const currentTrackIds = new Map(
    projects.map((project) => [project.id, project.track_ids])
  );
  const scoredProjects = new Map<string, Set<string>>();
  const scoreValues = new Map<string, Map<string, Record<string, number>>>();

  scoreRows.forEach((score) => {
    if (!currentTrackIds.get(score.project_id)?.includes(score.track_id)) {
      return;
    }

    if (!scoredProjects.has(score.project_id)) {
      scoredProjects.set(score.project_id, new Set());
    }
    scoredProjects.get(score.project_id)?.add(score.track_id);

    if (score.scores && typeof score.scores === "object") {
      if (!scoreValues.has(score.project_id)) {
        scoreValues.set(score.project_id, new Map());
      }
      scoreValues.get(score.project_id)?.set(score.track_id, score.scores);
    }
  });

  return { scoredProjects, scoreValues };
}

export function getNextProjectId(
  projects: Array<{ id: string }>,
  currentProjectId: string | null,
  direction: 1 | -1
): string | null {
  if (projects.length === 0) {
    return null;
  }

  if (!currentProjectId) {
    return projects[0].id;
  }

  const currentIndex = projects.findIndex(
    (project) => project.id === currentProjectId
  );

  if (currentIndex < 0) {
    return projects[0].id;
  }

  const nextIndex =
    direction === 1
      ? (currentIndex + 1) % projects.length
      : (currentIndex - 1 + projects.length) % projects.length;

  return projects[nextIndex].id;
}

export function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}
