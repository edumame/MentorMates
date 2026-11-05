import type { EventRole } from "@/lib/types";

/** The largest page GET /api/events/:eventId/users will return. */
const EVENT_USERS_PAGE_SIZE = 500;

export interface EventUser {
  user_id: string;
  uid: string;
  role: EventRole;
  display_name: string;
  email: string;
  affiliation: string;
  team_name: string;
}

interface FetchAllEventUsersOptions {
  eventId: string;
  /** Comma-separated roles, as accepted by the API's `roles` param. */
  roles: string;
  /** Required on the server, where relative URLs cannot be fetched. */
  baseUrl?: string;
  init?: RequestInit;
}

/**
 * Loads the complete membership list by walking the paged users API. Use this
 * wherever the result is treated as everyone in the event. Throws if any page
 * fails, so callers never mistake a partial list for the whole event.
 */
export async function fetchAllEventUsers({
  eventId,
  roles,
  baseUrl = "",
  init,
}: FetchAllEventUsersOptions): Promise<EventUser[]> {
  const users: EventUser[] = [];

  while (true) {
    const response = await fetch(
      `${baseUrl}/api/events/${eventId}/users?roles=${roles}&limit=${EVENT_USERS_PAGE_SIZE}&offset=${users.length}&includeCount=true`,
      init
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to fetch event users");
    }

    const page: EventUser[] = payload.users || [];
    users.push(...page);

    if (page.length === 0 || users.length >= (payload.count ?? 0)) {
      return users;
    }
  }
}
