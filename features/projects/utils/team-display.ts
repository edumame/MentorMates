import type { Project, ProjectTeamMember } from "@/lib/types";
import {
  buildProjectTeamMembers,
  normalizeEmail,
  projectTeamEmails,
} from "@/lib/projects/team-roster";

export interface ProjectTeamDisplayMember {
  key: string;
  id: string | null;
  displayName: string;
  avatarUrl: string | null;
  affiliation: string | null;
  role: "lead" | "member";
  /** Only present when the viewer's payload carried member emails (private route). */
  email: string | null;
}

type TeamProject = Pick<Project, "lead_name" | "team_members"> & {
  lead_email?: string | null;
  teammates?: string[] | null;
};

const toDisplay = (
  member: ProjectTeamMember,
  index: number,
  email: string | null
): ProjectTeamDisplayMember => ({
  key: email ?? member.id ?? `${member.role}-${index}`,
  id: member.id,
  displayName: member.display_name,
  avatarUrl: member.avatar_url,
  affiliation: member.affiliation,
  role: member.role,
  email,
});

/**
 * Shared roster for both project-detail routes, built from the server-resolved
 * `team_members`.
 * - Public payloads have no emails: the roster is used as-is.
 * - Authenticated payloads keep lead_email/teammates; the roster follows the
 *   current emails (so local teammate edits show up immediately) and borrows
 *   profile data from `team_members` by email. `fallbackNames` (email ->
 *   display name) labels members added since the payload was loaded.
 */
export function getProjectTeamDisplayMembers(
  project: TeamProject,
  fallbackNames: Record<string, string | null | undefined> = {}
): ProjectTeamDisplayMember[] {
  const emails = projectTeamEmails(project);
  const roster = project.team_members ?? [];

  if (emails.length === 0) {
    return roster.map((member, index) => toDisplay(member, index, null));
  }

  const byEmail = new Map(
    roster
      .filter((member) => member.email)
      .map((member) => [normalizeEmail(member.email), member])
  );
  return buildProjectTeamMembers(project, new Map(), { includeEmail: true }).map(
    (base, index) => {
      const email = base.email ?? emails[index];
      const known = byEmail.get(email);
      const fallbackName = fallbackNames[email]?.trim();
      const member = known ?? {
        ...base,
        display_name:
          base.role === "member" && fallbackName ? fallbackName : base.display_name,
      };
      return toDisplay(member, index, email);
    }
  );
}
