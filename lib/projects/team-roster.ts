import type { ProjectTeamMember } from "@/lib/types";

// Pure helpers (safe for client bundles). The service-client lookup lives in
// lib/projects/team-members.ts.

export type TeamSource = {
  lead_email?: string | null;
  lead_name?: string | null;
  teammates?: string[] | null;
};

export type TeamProfileRow = {
  uid: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  affiliation: string | null;
};

export type TeamProfileLookup = Map<string, TeamProfileRow>;

export const normalizeEmail = (email: string | null | undefined) =>
  email?.trim().toLowerCase() || "";

/** Raw (as stored) team emails, for profile lookups. */
export function rawProjectTeamEmails(source: TeamSource): string[] {
  return [source.lead_email, ...(source.teammates ?? [])].filter(
    (email): email is string => Boolean(email?.trim())
  );
}

/** Lead first, then teammates; de-duplicated and lower-cased. */
export function projectTeamEmails(source: TeamSource): string[] {
  const ordered = [source.lead_email, ...(source.teammates ?? [])]
    .map(normalizeEmail)
    .filter(Boolean);
  return Array.from(new Set(ordered));
}

/**
 * Email-free team roster safe to send to any viewer. Members without a
 * profile get a generic label rather than their email address.
 */
export function buildProjectTeamMembers(
  source: TeamSource,
  profiles: TeamProfileLookup,
  options: { includeEmail?: boolean } = {}
): ProjectTeamMember[] {
  const leadEmail = normalizeEmail(source.lead_email);
  return projectTeamEmails(source).map((email, index) => {
    const profile = profiles.get(email);
    const isLead = leadEmail ? email === leadEmail : index === 0;
    const fallbackName = isLead
      ? source.lead_name?.trim() || "Project lead"
      : "Team member";
    return {
      id: profile?.uid ?? null,
      display_name: profile?.display_name?.trim() || fallbackName,
      avatar_url: profile?.avatar_url?.trim() || null,
      affiliation: profile?.affiliation?.trim() || null,
      role: isLead ? "lead" : "member",
      ...(options.includeEmail ? { email } : {}),
    };
  });
}

