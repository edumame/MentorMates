/**
 * @jest-environment node
 */
import { GET, POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendOrganizerInviteEmails } from "@/lib/events/invite-emails";
import { reserveInviteQuota } from "@/lib/email/invite-quota";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock("@/lib/email/invite-quota", () => ({ reserveInviteQuota: jest.fn(async () => null) }));
jest.mock("@/lib/events/invite-emails", () => ({
  ...jest.requireActual("@/lib/events/invite-emails"),
  sendOrganizerInviteEmails: jest.fn(async () => ({ sent: 0, failed: [] })),
  sendEventInviteEmails: jest.fn(async () => ({ deferred: true, sent: {}, failed: {} })),
}));

type Call = [string, ...unknown[]];
type Result = { data: unknown; error: unknown };

/** Chainable PostgREST-like builder that records every call per table. */
function makeClient(results: Record<string, Result>, user: { id: string; email?: string } | null, isAdmin = false) {
  const calls: Record<string, Call[]> = {};
  const from = jest.fn((table: string) => {
    const log: Call[] = (calls[table] ||= []);
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "or", "insert", "upsert", "order"]) {
      builder[method] = jest.fn((...args: unknown[]) => {
        log.push([method, ...args]);
        return builder;
      });
    }
    const result = () => results[table] ?? { data: null, error: null };
    builder.single = jest.fn(async () => result());
    builder.maybeSingle = jest.fn(async () => result());
    builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject);
    return builder;
  });
  return {
    calls,
    client: {
      from,
      auth: { getUser: jest.fn(async () => ({ data: { user }, error: null })) },
      rpc: jest.fn(async () => ({ data: isAdmin, error: null })),
    },
  };
}

const selectArg = (calls: Call[]) => String(calls.find((c) => c[0] === "select")?.[1]);

describe("GET /api/events", () => {
  it("returns only listed (public + approved) events with card columns to anonymous callers", async () => {
    const { client, calls } = makeClient({ events: { data: [{ event_id: "e1" }], error: null } }, null);
    jest.mocked(createSupabaseClient).mockResolvedValue(client as never);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(calls.events).toEqual(
      expect.arrayContaining([
        ["eq", "visibility", "public"],
        ["eq", "approval_status", "approved"],
      ])
    );
    expect(calls.events.some((c) => c[0] === "in")).toBe(false); // no private enumeration
    expect(selectArg(calls.events)).not.toContain("*");
    expect(selectArg(calls.events)).not.toContain("paywall_content");
  });

  it("adds only the caller's own events (any visibility) for signed-in members", async () => {
    const roles = [
      { event_id: "11111111-1111-4111-8111-111111111111", role: "organizer" },
      { event_id: "22222222-2222-4222-8222-222222222222", role: "participant" },
    ];
    const { client, calls } = makeClient(
      { user_event_roles: { data: roles, error: null }, events: { data: [], error: null } },
      { id: "u1" }
    );
    jest.mocked(createSupabaseClient).mockResolvedValue(client as never);

    await GET();
    const or = calls.events.find((c) => c[0] === "or");
    expect(or?.[1]).toBe(
      "and(visibility.eq.public,approval_status.eq.approved)," +
        `event_id.in.(${roles[0].event_id},${roles[1].event_id})`
    );
    expect(selectArg(calls.events)).not.toContain("*");
  });

  it("falls back to listed events for signed-in users with no roles", async () => {
    const { client, calls } = makeClient(
      { user_event_roles: { data: [], error: null }, events: { data: [], error: null } },
      { id: "u1" }
    );
    jest.mocked(createSupabaseClient).mockResolvedValue(client as never);

    await GET();
    expect(calls.events).toEqual(expect.arrayContaining([["eq", "approval_status", "approved"]]));
    expect(calls.events.some((c) => c[0] === "or")).toBe(false);
  });

  it("returns 500 when the listing query fails", async () => {
    const { client } = makeClient({ events: { data: null, error: { message: "boom" } } }, null);
    jest.mocked(createSupabaseClient).mockResolvedValue(client as never);
    jest.spyOn(console, "error").mockImplementation(() => {});

    expect((await GET()).status).toBe(500);
  });
});

describe("POST /api/events", () => {
  const validEvent = {
    event_name: "QA Hack Night",
    event_date: "2026-12-01",
    location: "Online",
  };
  const request = (body: unknown) =>
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  function setup() {
    const user = makeClient(
      {
        events: { data: { event_id: "evt-1", event_name: "QA Hack Night", slug: null, visibility: "draft" }, error: null },
        user_profiles: { data: { display_name: "Org", email: "org@example.test" }, error: null },
      },
      { id: "org-1", email: "org@example.test" }
    );
    const service = makeClient({ user_event_roles: { data: null, error: null } }, null);
    jest.mocked(createSupabaseClient).mockResolvedValue(user.client as never);
    jest.mocked(createSupabaseServiceClient).mockReturnValue(service.client as never);
    return { user, service };
  }

  beforeEach(() => jest.mocked(sendOrganizerInviteEmails).mockClear());

  it.each([
    ["a name longer than 120 characters", { event_name: "x".repeat(121) }],
    ["a whitespace-only name", { event_name: "   " }],
    ["a naive (offset-less) submission time", { submission_time_start: "2026-12-01T10:00" }],
    [
      "a cutoff before the start",
      { submission_time_start: "2026-12-01T18:00:00.000Z", submission_time_cutoff: "2026-11-30T18:00:00.000Z" },
    ],
    [
      "a cutoff equal to the start",
      { submission_time_start: "2026-12-01T18:00:00.000Z", submission_time_cutoff: "2026-12-01T18:00:00.000Z" },
    ],
  ])("rejects %s with 400 before inserting", async (_label, override) => {
    const { user } = setup();
    const res = await POST(request({ event: { ...validEvent, ...override } }));
    expect(res.status).toBe(400);
    expect(user.calls.events).toBeUndefined();
  });

  it("accepts an offset-qualified submission window that closes after it opens", async () => {
    const { user } = setup();
    const res = await POST(
      request({
        event: {
          ...validEvent,
          submission_time_start: "2026-12-01T18:00:00.000Z",
          submission_time_cutoff: "2026-12-02T18:00:00-08:00",
        },
      })
    );
    expect(res.status).toBe(201);
    const insert = user.calls.events.find((c) => c[0] === "insert")?.[1] as Record<string, unknown>;
    expect(insert.submission_time_start).toBe("2026-12-01T18:00:00.000Z");
  });

  it("never grants co-organizer roles by email; every invitee gets a pending signed invitation", async () => {
    const { user, service } = setup();
    const res = await POST(
      request({
        event: validEvent,
        organizerEmails: ["Existing@Example.test", "new@example.test", "org@example.test"],
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();

    // No lookup of the user-editable user_profiles.email to grant roles.
    expect(service.calls.user_profiles).toBeUndefined();
    // Only the creator's own organizer role is written.
    const upserts = [...(service.calls.user_event_roles ?? []), ...(user.calls.user_event_roles ?? [])]
      .filter((c) => c[0] === "upsert")
      .map((c) => c[1] as { user_id: string });
    expect(upserts).toEqual([expect.objectContaining({ user_id: "org-1", role: "organizer" })]);

    expect(sendOrganizerInviteEmails).toHaveBeenCalledWith(
      expect.objectContaining({ newOrganizerEmails: ["existing@example.test", "new@example.test"] })
    );
    expect(jest.mocked(sendOrganizerInviteEmails).mock.calls[0][0]).not.toHaveProperty("existingOrganizerEmails");
    // Response does not disclose which addresses have accounts.
    expect(body.missingOrganizerEmails).toEqual([]);
    expect(body.pendingOrganizerInvites).toBe(2);
  });
});

describe("POST /api/events slug validation (ORG-014)", () => {
  const request = (event: Record<string, unknown>) =>
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { event_name: "QA Slug", event_date: "2026-12-01", location: "Online", ...event } }),
    });

  beforeEach(() => {
    const user = makeClient({}, { id: "org-1", email: "org@example.test" });
    jest.mocked(createSupabaseClient).mockResolvedValue(user.client as never);
    jest.mocked(createSupabaseServiceClient).mockReturnValue(makeClient({}, null).client as never);
  });

  it.each(["", "Bad Slug/With Spaces", "123e4567-e89b-42d3-a456-426614174000"])(
    "rejects slug %p with 400",
    async (slug) => {
      expect((await POST(request({ slug }))).status).toBe(400);
    }
  );

  it("maps a duplicate slug to a specific message", async () => {
    const user = makeClient(
      { events: { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "events_slug_key"' } } },
      { id: "org-1", email: "org@example.test" }
    );
    jest.mocked(createSupabaseClient).mockResolvedValue(user.client as never);
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(request({ slug: "taken-slug" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/already taken/);
  });
});

describe("POST /api/events moderation clamp (ORG-002 round 2)", () => {
  const request = (event: Record<string, unknown>) =>
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { event_name: "QA Clamp", event_date: "2026-12-01", location: "Online", ...event } }),
    });

  function setupAs(isAdmin: boolean) {
    const user = makeClient(
      { events: { data: { event_id: "evt-9", event_name: "QA Clamp", slug: null, visibility: "private" }, error: null } },
      { id: "org-1", email: "org@example.test" },
      isAdmin
    );
    jest.mocked(createSupabaseClient).mockResolvedValue(user.client as never);
    jest.mocked(createSupabaseServiceClient).mockReturnValue(makeClient({}, null).client as never);
    return user;
  }
  const inserted = (user: ReturnType<typeof setupAs>) =>
    user.calls.events.find((c) => c[0] === "insert")?.[1] as Record<string, unknown>;

  it("creates a non-admin's public, approved, featured request as private + not_submitted + unfeatured", async () => {
    const user = setupAs(false);
    const res = await POST(request({ visibility: "public", approval_status: "approved", featured: true }));
    expect(res.status).toBe(201);
    expect(inserted(user)).toMatchObject({ visibility: "private", approval_status: "not_submitted", featured: false });
    expect((await res.json()).publicListingRequiresApproval).toBe(true);
  });

  it("keeps draft for non-admins", async () => {
    const user = setupAs(false);
    await POST(request({ visibility: "draft" }));
    expect(inserted(user)).toMatchObject({ visibility: "draft", approval_status: "not_submitted" });
  });

  it("lets admins create public approved events", async () => {
    const user = setupAs(true);
    await POST(request({ visibility: "public", approval_status: "approved" }));
    expect(inserted(user)).toMatchObject({ visibility: "public", approval_status: "approved" });
  });
});

describe("POST /api/events external_url (PUB-001 round 2)", () => {
  it.each(["javascript:alert(1)", "data:text/html,x"])("rejects %p with 400", async (external_url) => {
    const user = makeClient({}, { id: "org-1", email: "org@example.test" });
    jest.mocked(createSupabaseClient).mockResolvedValue(user.client as never);
    jest.mocked(createSupabaseServiceClient).mockReturnValue(makeClient({}, null).client as never);
    const res = await POST(
      new Request("http://localhost/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: { event_name: "QA Url", event_date: "2026-12-01", location: "Online", external_url } }),
      })
    );
    expect(res.status).toBe(400);
    expect(user.calls.events).toBeUndefined();
  });
});

describe("POST /api/events co-organizer invite quota (A2 round 2)", () => {
  const original = process.env.RESEND_API_KEY;
  afterAll(() => {
    process.env.RESEND_API_KEY = original;
  });

  it("reserves quota per invite and reports invites past the cap as failed", async () => {
    process.env.RESEND_API_KEY = "re_test_placeholder";
    const user = makeClient(
      { events: { data: { event_id: "evt-q", event_name: "Q", slug: null, visibility: "draft" }, error: null } },
      { id: "org-1", email: "org@example.test" }
    );
    jest.mocked(createSupabaseClient).mockResolvedValue(user.client as never);
    jest.mocked(createSupabaseServiceClient).mockReturnValue(makeClient({}, null).client as never);
    jest.mocked(sendOrganizerInviteEmails).mockClear();
    jest.mocked(reserveInviteQuota)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: 429 } as never);

    const res = await POST(
      new Request("http://localhost/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: { event_name: "QA Quota", event_date: "2026-12-01", location: "Online" },
          organizerEmails: ["a@example.test", "b@example.test", "c@example.test"],
        }),
      })
    );
    expect(res.status).toBe(201);
    expect(reserveInviteQuota).toHaveBeenCalledTimes(2);
    expect(jest.mocked(sendOrganizerInviteEmails).mock.calls[0][0].newOrganizerEmails).toEqual(["a@example.test"]);
    expect((await res.json()).organizerInviteSummary.failed).toEqual(["b@example.test", "c@example.test"]);
  });
});
