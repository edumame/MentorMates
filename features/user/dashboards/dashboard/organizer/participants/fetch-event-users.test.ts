import { EventRole } from "@/lib/types";
import { EVENT_USERS_MAX_PAGE_SIZE, fetchAllEventUsers } from "./fetch-event-users";

const makeUsers = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    user_id: `u${from + i}`, role: EventRole.Participant, uid: `u${from + i}`,
    display_name: "", email: `u${from + i}@example.test`, affiliation: "", team_name: "",
  }));

function server(total: number, { omitCount = false } = {}) {
  return jest.fn(async (url: string) => {
    const params = new URL(url, "http://localhost").searchParams;
    const offset = Number(params.get("offset"));
    const limit = Number(params.get("limit"));
    const users = makeUsers(offset, Math.max(0, Math.min(limit, total - offset)));
    return {
      ok: true,
      json: async () => ({ users, count: !omitCount && params.get("includeCount") === "true" ? total : undefined }),
    } as Response;
  });
}

describe("fetchAllEventUsers (ORG-024)", () => {
  it("pages through 1,200 users instead of stopping at 500", async () => {
    const fetchImpl = server(1200);
    const { users, total } = await fetchAllEventUsers("evt", [EventRole.Participant], fetchImpl as unknown as typeof fetch);
    expect(users).toHaveLength(1200);
    expect(total).toBe(1200);
    expect(new Set(users.map((u) => u.user_id)).size).toBe(1200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[2][0]).toContain(`offset=${2 * EVENT_USERS_MAX_PAGE_SIZE}`);
  });

  it("stops after an exactly-full last page using the count", async () => {
    const fetchImpl = server(1000);
    const { users } = await fetchAllEventUsers("evt", [EventRole.Participant], fetchImpl as unknown as typeof fetch);
    expect(users).toHaveLength(1000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("falls back to short-page detection when no count is returned", async () => {
    const fetchImpl = server(700, { omitCount: true });
    const { users, total } = await fetchAllEventUsers("evt", [EventRole.Participant], fetchImpl as unknown as typeof fetch);
    expect(users).toHaveLength(700);
    expect(total).toBe(700);
  });

  it("handles an empty event", async () => {
    const { users } = await fetchAllEventUsers("evt", [EventRole.Participant], server(0) as unknown as typeof fetch);
    expect(users).toEqual([]);
  });

  it("throws the API error", async () => {
    const fetchImpl = jest.fn(async () => ({ ok: false, json: async () => ({ error: "Forbidden" }) }) as Response);
    await expect(fetchAllEventUsers("evt", [EventRole.Participant], fetchImpl as unknown as typeof fetch)).rejects.toThrow("Forbidden");
  });
});
