import type { Project } from "@/lib/types";

export type TeamMember = {
  email: string;
  displayName: string;
  role: "lead" | "member";
};

/**
 * Lead first, then teammates, named from the API's team_profiles. An unnamed
 * lead uses lead_name; an unnamed teammate uses fallbackName, then their email.
 */
export function buildTeamMembers(
  project: Pick<
    Project,
    "lead_email" | "lead_name" | "teammates" | "team_profiles"
  >,
  fallbackName?: (email: string) => string | null | undefined
): TeamMember[] {
  const profileName = (email: string) =>
    project.team_profiles?.[email.toLowerCase()]?.display_name;

  return [
    {
      email: project.lead_email,
      displayName: profileName(project.lead_email) || project.lead_name,
      role: "lead",
    },
    ...(project.teammates ?? []).map((email) => ({
      email,
      displayName: profileName(email) || fallbackName?.(email) || email,
      role: "member" as const,
    })),
  ];
}
