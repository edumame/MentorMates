import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserProjectIds } from "@/lib/projects/membership";

export interface DashboardCounts {
  projects: number;
  events: number;
  feedback: number;
}

/** Roles that mean the user took part in an event (organizing is not attending). */
export const ATTENDING_ROLES = ["participant", "mentor", "judge"] as const;

/** Visibilities that never count as attended. NULL visibility counts. */
const NOT_ATTENDED_VISIBILITY = new Set(["draft", "archived"]);

/**
 * Personal dashboard counts (DASH-001):
 * - events: distinct events the user joined as participant/mentor/judge that
 *   have already taken place (event_date <= now), excluding draft/archived
 * - projects: distinct projects the user leads or is a teammate on
 *   (my_project_ids: case-insensitive, by verified auth email)
 * - feedback: feedback rows on exactly those projects
 * Throws on any query error so the caller can show an error instead of 0.
 */
export async function fetchDashboardCounts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  user: { id: string },
  now = new Date()
): Promise<DashboardCounts> {
  const [{ data: roleRows, error: rolesError }, projectResult] = await Promise.all([
    supabase
      .from("user_event_roles")
      .select("event_id, role")
      .eq("user_id", user.id)
      .in("role", [...ATTENDING_ROLES]),
    getUserProjectIds(supabase),
  ]);
  if (rolesError) throw rolesError;
  if (projectResult.error || !projectResult.ids) throw projectResult.error;

  const joinedEventIds = Array.from(
    new Set(((roleRows ?? []) as Array<{ event_id: string }>).map((row) => row.event_id))
  );
  let events = 0;
  if (joinedEventIds.length > 0) {
    const { data, error } = await supabase
      .from("events")
      .select("event_id, event_date, visibility")
      .in("event_id", joinedEventIds);
    if (error) throw error;
    events = ((data ?? []) as Array<{ event_date: string | null; visibility: string | null }>).filter(
      (event) => {
        if (event.visibility && NOT_ATTENDED_VISIBILITY.has(event.visibility)) return false;
        const date = event.event_date ? new Date(event.event_date) : null;
        return Boolean(date && !Number.isNaN(date.getTime()) && date <= now);
      }
    ).length;
  }

  const projectIds = projectResult.ids;
  let feedback = 0;
  if (projectIds.length > 0) {
    const { count, error } = await supabase
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .in("project_id", projectIds);
    if (error) throw error;
    feedback = count ?? 0;
  }

  return { projects: projectIds.length, events, feedback };
}
