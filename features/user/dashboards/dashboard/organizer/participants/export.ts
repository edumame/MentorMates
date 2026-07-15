import Papa from "papaparse";

export interface ExportableParticipant {
  display_name: string;
  email: string;
  role: string;
  affiliation?: string | null;
}

export interface TeamProjectRow {
  project_name: string | null;
  lead_email: string | null;
  teammates: string[] | null;
}

/**
 * Map each member email (lead + teammates, lowercased) to their team's
 * project name. When someone appears on multiple projects, the first
 * project row wins so the export stays deterministic.
 */
export function buildEmailTeamMap(
  projects: TeamProjectRow[]
): Map<string, string> {
  const teamByEmail = new Map<string, string>();

  for (const project of projects) {
    const teamName = project.project_name?.trim();
    if (!teamName) continue;

    const memberEmails = [project.lead_email, ...(project.teammates ?? [])];
    for (const email of memberEmails) {
      const normalized = email?.trim().toLowerCase();
      if (!normalized || teamByEmail.has(normalized)) continue;
      teamByEmail.set(normalized, teamName);
    }
  }

  return teamByEmail;
}

export function buildParticipantsCsv(
  participants: ExportableParticipant[],
  teamByEmail: Map<string, string>
): string {
  return Papa.unparse(
    participants.map((participant) => ({
      Name: participant.display_name,
      Email: participant.email,
      Role: participant.role,
      "Team Name": teamByEmail.get(participant.email.trim().toLowerCase()) ?? "",
      University: participant.affiliation ?? "",
    }))
  );
}
