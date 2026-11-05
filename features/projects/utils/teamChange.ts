export interface TeamChange {
  added: string[];
  removed: string[];
}

const hasEmail = (emails: string[], email: string): boolean =>
  emails.some((entry) => entry.toLowerCase() === email.toLowerCase());

export function diffTeamEmails(previous: string[], next: string[]): TeamChange {
  return {
    added: next.filter((email) => !hasEmail(previous, email)),
    removed: previous.filter((email) => !hasEmail(next, email)),
  };
}

export function applyTeamChange(
  current: string[],
  { added, removed }: TeamChange
): string[] {
  const kept = current.filter((email) => !hasEmail(removed, email));
  return added.reduce(
    (team, email) => (hasEmail(team, email) ? team : [...team, email]),
    kept
  );
}
