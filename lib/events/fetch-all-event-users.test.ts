import { fetchAllEventUsers } from "./fetch-all-event-users";
import { fakeEventUsersResponse } from "./fake-event-users-api";

function mockFetch(total: number) {
  return jest
    .spyOn(global, "fetch")
    .mockImplementation(
      async (input) =>
        fakeEventUsersResponse(String(input), total) as unknown as Response
    );
}

describe("fetchAllEventUsers", () => {
  beforeEach(() => {
    // jsdom has no fetch for jest.spyOn to wrap.
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [0, 1],
    [499, 1],
    [500, 1],
    [501, 2],
    [1000, 2],
    [1203, 3],
  ])("returns all %i users in %i request(s)", async (total, requests) => {
    const fetchSpy = mockFetch(total);

    const users = await fetchAllEventUsers({
      eventId: "event-1",
      roles: "participant",
    });

    expect(users).toHaveLength(total);
    expect(new Set(users.map((u) => u.user_id)).size).toBe(total);
    expect(fetchSpy).toHaveBeenCalledTimes(requests);
  });

  it("keeps paging when the server returns less than the requested page", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      const offset = Number(new URL(String(input), "http://x").searchParams.get("offset"));
      const users = Array.from({ length: Math.min(100, 250 - offset) }, (_, i) => ({
        user_id: `user-${offset + i}`,
      }));
      return { ok: true, json: async () => ({ users, count: 250 }) } as unknown as Response;
    });

    const users = await fetchAllEventUsers({ eventId: "e", roles: "participant" });

    expect(users).toHaveLength(250);
    expect(String(fetchSpy.mock.calls[1][0])).toContain("offset=100");
  });

  it("stops if the server runs out of rows before reaching count", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      const offset = Number(new URL(String(input), "http://x").searchParams.get("offset"));
      const users = offset === 0 ? [{ user_id: "only" }] : [];
      return { ok: true, json: async () => ({ users, count: 2 }) } as unknown as Response;
    });

    await expect(
      fetchAllEventUsers({ eventId: "e", roles: "participant" })
    ).resolves.toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("builds an absolute URL and forwards request options for server callers", async () => {
    const fetchSpy = mockFetch(1);

    await fetchAllEventUsers({
      eventId: "event-1",
      roles: "participant,mentor",
      baseUrl: "https://app.test",
      init: { cache: "no-store", headers: { cookie: "a=b" } },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://app.test/api/events/event-1/users?roles=participant,mentor&limit=500&offset=0&includeCount=true",
      { cache: "no-store", headers: { cookie: "a=b" } }
    );
  });

  it("rejects rather than returning a partial list when a page fails", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("offset=500")) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: "Failed to fetch event users" }),
        } as unknown as Response;
      }
      return fakeEventUsersResponse(String(input), 501) as unknown as Response;
    });

    await expect(
      fetchAllEventUsers({ eventId: "event-1", roles: "participant" })
    ).rejects.toThrow("Failed to fetch event users");
  });
});
