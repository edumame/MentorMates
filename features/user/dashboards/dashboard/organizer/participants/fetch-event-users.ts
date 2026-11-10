import type { EventRole } from "@/lib/types";

/**
 * Paging contract of GET /api/events/[eventId]/users (ORG-024):
 * - `limit` is clamped to 1..EVENT_USERS_MAX_PAGE_SIZE (default 100);
 * - `offset` is 0-based; rows are ordered by (created_at, user_id) so pages are
 *   stable;
 * - `includeCount=true` adds `count` (exact total for the requested roles).
 * A page shorter than `limit` is the last page.
 */
export const EVENT_USERS_MAX_PAGE_SIZE = 500;

export interface EventUserRow {
  user_id: string;
  role: EventRole;
  uid: string;
  display_name: string;
  email: string;
  affiliation: string;
  team_name: string;
}

interface EventUsersPage {
  users?: EventUserRow[];
  count?: number;
  error?: string;
}

/** Hard stop so a misbehaving server can never loop forever. */
const MAX_PAGES = 1000;

/** Fetches every user of the event with the given roles, page by page. */
export async function fetchAllEventUsers(
  eventId: string,
  roles: EventRole[],
  fetchImpl: typeof fetch = fetch
): Promise<{ users: EventUserRow[]; total: number }> {
  const users: EventUserRow[] = [];
  let total: number | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      roles: roles.join(","),
      limit: String(EVENT_USERS_MAX_PAGE_SIZE),
      offset: String(users.length),
    });
    if (total === null) params.set("includeCount", "true");

    const response = await fetchImpl(`/api/events/${eventId}/users?${params.toString()}`);
    const payload = (await response.json().catch(() => ({}))) as EventUsersPage;
    if (!response.ok) {
      throw new Error(payload.error || "Failed to fetch participants");
    }

    const pageUsers = payload.users ?? [];
    if (total === null) total = typeof payload.count === "number" ? payload.count : null;
    users.push(...pageUsers);

    const reachedTotal = total !== null && users.length >= total;
    if (pageUsers.length < EVENT_USERS_MAX_PAGE_SIZE || reachedTotal) break;
  }

  return { users, total: total ?? users.length };
}
