/**
 * Order projects on the participant voting page: the viewer's own ballot first,
 * then alphabetically. Never by vote count — totals stay hidden from voters so
 * the grid order must not leak the leaderboard (JUDGE-002).
 */
export function sortProjectsForVoting<
  T extends { id: string; project_name?: string | null },
>(projects: readonly T[], hasVoted: (projectId: string) => boolean): T[] {
  return [...projects].sort((a, b) => {
    const aVoted = hasVoted(a.id) ? 1 : 0;
    const bVoted = hasVoted(b.id) ? 1 : 0;
    if (aVoted !== bVoted) return bVoted - aVoted;
    const byName = (a.project_name ?? "").localeCompare(b.project_name ?? "", undefined, {
      sensitivity: "base",
    });
    return byName !== 0 ? byName : a.id.localeCompare(b.id);
  });
}
