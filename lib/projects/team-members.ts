import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { ProjectTeamMember } from "@/lib/types";
import {
  buildProjectTeamMembers,
  normalizeEmail,
  rawProjectTeamEmails,
  type TeamProfileLookup,
  type TeamProfileRow,
  type TeamSource,
} from "@/lib/projects/team-roster";

export {
  buildProjectTeamMembers,
  projectTeamEmails,
  rawProjectTeamEmails,
} from "@/lib/projects/team-roster";
export type { TeamProfileLookup } from "@/lib/projects/team-roster";

/**
 * Loads display profiles for team emails with the service client. user_profiles
 * RLS hides other users from participants and anonymous viewers, so the
 * client-side lookup the project pages used to do silently fell back to
 * showing raw email addresses.
 */
export async function fetchTeamProfiles(
  emails: string[]
): Promise<TeamProfileLookup> {
  const lookup: TeamProfileLookup = new Map();
  const candidates = Array.from(
    new Set(
      emails
        .filter(Boolean)
        .flatMap((email) => [email.trim(), normalizeEmail(email)])
    )
  ).filter(Boolean);
  if (candidates.length === 0) return lookup;
  try {
    const serviceClient = createSupabaseServiceClient();
    const { data, error } = await serviceClient
      .from("user_profiles")
      .select("uid, email, display_name, avatar_url, affiliation")
      .in("email", candidates);
    if (error || !data) return lookup;
    for (const row of data as TeamProfileRow[]) {
      const key = normalizeEmail(row.email);
      if (key) lookup.set(key, row);
    }
  } catch (error) {
    // Profiles only decorate the team list; fall back to names on the project row.
    console.error("Failed to load team profiles:", error);
  }
  return lookup;
}


export type PublicTeamRoster = {
  members: ProjectTeamMember[];
  /** Kept server-side only, for resolving legacy ?p=<email> certificate links. */
  source: TeamSource;
  profiles: TeamProfileLookup;
};

/**
 * Builds email-free rosters for projects the caller has already been allowed
 * to read. anon has no column privilege on projects.lead_email/teammates
 * (migration 202611080501), so the emails are read with the service client,
 * restricted to the given project ids.
 */
export async function fetchPublicTeamRosters(
  projectIds: string[]
): Promise<Map<string, PublicTeamRoster>> {
  const rosters = new Map<string, PublicTeamRoster>();
  if (projectIds.length === 0) return rosters;
  let rows: Array<TeamSource & { id: string }> = [];
  try {
    const serviceClient = createSupabaseServiceClient();
    const { data, error } = await serviceClient
      .from("projects")
      .select("id, lead_name, lead_email, teammates")
      .in("id", projectIds);
    if (error) {
      console.error("Failed to load project teams:", error);
    } else {
      rows = (data ?? []) as Array<TeamSource & { id: string }>;
    }
  } catch (error) {
    console.error("Failed to load project teams:", error);
  }
  const profiles = await fetchTeamProfiles(
    rows.flatMap((row) => rawProjectTeamEmails(row))
  );
  for (const row of rows) {
    rosters.set(row.id, {
      members: buildProjectTeamMembers(row, profiles),
      source: row,
      profiles,
    });
  }
  return rosters;
}
