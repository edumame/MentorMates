export interface JudgeProjectPair {
  judgeId: string;
  projectId: string;
}

export interface AssignableTrack {
  track_id: string;
  name: string;
  projectCount: number;
}

export function buildJudgeProjectPairs(
  judgeIds: Iterable<string>,
  projectIds: Iterable<string>
): JudgeProjectPair[] {
  const uniqueJudgeIds = [...new Set(judgeIds)].filter(Boolean);
  const uniqueProjectIds = [...new Set(projectIds)].filter(Boolean);

  return uniqueJudgeIds.flatMap((judgeId) =>
    uniqueProjectIds.map((projectId) => ({
      judgeId,
      projectId,
    }))
  );
}

export function getAssignableTracks(
  projects: Array<{
    tracks?: Array<{
      track_id: string;
      name?: string | null;
      label?: string | null;
    }>;
  }>
): AssignableTrack[] {
  const tracksById = new Map<string, AssignableTrack>();

  for (const project of projects) {
    for (const track of project.tracks || []) {
      const existingTrack = tracksById.get(track.track_id);
      const displayName = track.label || track.name || "Unnamed Track";

      if (existingTrack) {
        existingTrack.projectCount += 1;
        continue;
      }

      tracksById.set(track.track_id, {
        track_id: track.track_id,
        name: displayName,
        projectCount: 1,
      });
    }
  }

  return [...tracksById.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}
