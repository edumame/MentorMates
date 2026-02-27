export interface JudgeProjectPair {
  judgeId: string;
  projectId: string;
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
