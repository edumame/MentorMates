import type { SupabaseClient } from "@supabase/supabase-js";

// projects.lead_email / teammates are not readable by client roles
// (migrations 202611080501 + 202611080505). Membership and team emails go
// through SECURITY DEFINER functions keyed on the caller's auth identity.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

/**
 * Ids of projects the signed-in caller leads or is a teammate on
 * (case-insensitive match on their verified auth email), optionally within
 * one event. Returns `{ error }` rather than an empty list when the call
 * fails, so callers can't mistake a failure for "no projects".
 */
export async function getUserProjectIds(
  supabase: AnyClient,
  eventId?: string | null
): Promise<{ ids: string[]; error: null } | { ids: null; error: unknown }> {
  const { data, error } = await supabase.rpc(
    "my_project_ids",
    eventId ? { p_event_id: eventId } : {}
  );
  if (error) return { ids: null, error };
  const ids = Array.from(
    new Set(
      ((data ?? []) as Array<string | { my_project_ids: string }>).map((row) =>
        typeof row === "string" ? row : row.my_project_ids
      )
    )
  );
  return { ids, error: null };
}

export type TeamEmails = { lead_email: string; teammates: string[] };

/**
 * Team emails for the projects the caller may see them for (team members,
 * the event's organizers, admins). Projects the caller may not see are simply
 * absent from the map.
 */
export async function getTeamEmails(
  supabase: AnyClient,
  projectIds: string[]
): Promise<Map<string, TeamEmails>> {
  const map = new Map<string, TeamEmails>();
  if (projectIds.length === 0) return map;
  const { data, error } = await supabase.rpc("project_team_emails", {
    p_project_ids: projectIds,
  });
  if (error) {
    console.error("project_team_emails failed:", error);
    return map;
  }
  for (const row of (data ?? []) as Array<{
    project_id: string;
    lead_email: string | null;
    teammates: string[] | null;
  }>) {
    map.set(row.project_id, {
      lead_email: row.lead_email ?? "",
      teammates: row.teammates ?? [],
    });
  }
  return map;
}
