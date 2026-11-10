export type TeammateChanges = {
  add?: string[];
  remove?: string[];
};

/**
 * Team membership also changes outside the form being edited (invite links
 * join through /api/projects/join), so writers must apply their own changes
 * to the stored list instead of replacing it with a list they loaded earlier.
 */
export function applyTeammateChanges(
  storedTeammates: string[] | null | undefined,
  { add = [], remove = [] }: TeammateChanges,
): string[] {
  const removed = new Set(remove.map((email) => email.toLowerCase()));
  const teammates = (storedTeammates ?? []).filter(
    (email) => !removed.has(email.toLowerCase()),
  );
  const present = new Set(teammates.map((email) => email.toLowerCase()));

  for (const email of add) {
    if (!present.has(email.toLowerCase())) {
      present.add(email.toLowerCase());
      teammates.push(email);
    }
  }

  return teammates;
}
