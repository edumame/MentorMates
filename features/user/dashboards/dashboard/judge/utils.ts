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
