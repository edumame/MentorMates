/**
 * Test double for GET /api/events/:eventId/users. Mirrors the real route's
 * paging contract: limit is capped at 500, and `count` is only returned when
 * includeCount=true.
 */
export function makeEventUsers(total: number) {
  return Array.from({ length: total }, (_, i) => ({
    user_id: `user-${i}`,
    uid: `user-${i}`,
    role: "participant",
    display_name: `Person ${i}`,
    email: `person${i}@example.com`,
    affiliation: "",
    team_name: "",
  }));
}

export function fakeEventUsersResponse(url: string, total: number) {
  const params = new URL(url, "http://localhost").searchParams;
  const limit = Math.min(Number(params.get("limit") || 100), 500);
  const offset = Number(params.get("offset") || 0);
  const body = {
    users: makeEventUsers(total).slice(offset, offset + limit),
    count: params.get("includeCount") === "true" ? total : undefined,
  };
  return { ok: true, status: 200, json: async () => body };
}
