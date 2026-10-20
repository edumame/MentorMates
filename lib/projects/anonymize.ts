/**
 * Project submission anonymization helper.
 *
 * When an event's `submissions_anonymized` flag is on, we strip participant
 * identity from project records before returning them to non-organizer viewers
 * (judges, mentors, participants, public).
 *
 * Organizers + global admins always see real identities so they can still
 * administer the event.
 */

const ANON_LABEL = "Anonymous";

/** Shape of a project as it flows through the /api/projects responses. */
export type AnonymizableProject = {
  lead_name?: string | null;
  lead_email?: string | null;
  created_by?: string | null;
  owner_id?: string | null;
  teammates?: unknown;
  team_members?: unknown;
  teammate_profiles?: unknown;
  cover_image_url?: string | null;
  // Allow extra fields to flow through unchanged.
  [key: string]: unknown;
};

function anonymizeTeammates(value: unknown): unknown {
  if (!Array.isArray(value)) return [];
  // teammates may be string[] (emails) or array of objects with names; either
  // way, replace each with an Anonymous placeholder. For email arrays, return
  // an empty array — emails are PII.
  return value.map((entry) => {
    if (typeof entry === "string") {
      // Emails are PII — drop them.
      return null;
    }
    if (entry && typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      return {
        ...obj,
        name: ANON_LABEL,
        display_name: ANON_LABEL,
        email: null,
        avatar_url: null,
      };
    }
    return ANON_LABEL;
  }).filter((entry) => entry !== null);
}

/**
 * Redact identifying fields on a single project when the viewer cannot see
 * real identities. No-op when `isOrganizerOrAdmin` is true.
 */
export function redactAnonymizedProject<T extends AnonymizableProject>(
  project: T,
  isOrganizerOrAdmin: boolean
): T {
  if (isOrganizerOrAdmin) return project;

  return {
    ...project,
    lead_name: ANON_LABEL,
    lead_email: null,
    created_by: null,
    owner_id: null,
    cover_image_url: null,
    teammates: anonymizeTeammates(project.teammates),
    team_members: anonymizeTeammates(project.team_members),
    teammate_profiles: [],
  };
}

/**
 * Apply `redactAnonymizedProject` across a list. Pure — returns a new array.
 */
export function redactAnonymizedProjects<T extends AnonymizableProject>(
  projects: T[],
  isOrganizerOrAdmin: boolean
): T[] {
  if (isOrganizerOrAdmin) return projects;
  return projects.map((p) => redactAnonymizedProject(p, isOrganizerOrAdmin));
}
