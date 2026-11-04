/**
 * @jest-environment node
 */

const rpcMock = jest.fn();
const insertSingleMock = jest.fn();
const insertMock = jest.fn<
  { select: () => { single: typeof insertSingleMock } },
  [Record<string, unknown>]
>(() => ({
  select: jest.fn(() => ({ single: insertSingleMock })),
}));

const fromMock = jest.fn((table: string) => {
  if (table === "events") return { insert: insertMock };
  if (table === "user_event_roles") {
    return { upsert: jest.fn(async () => ({ error: null })) };
  }
  if (table === "user_profiles") {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
        }),
      }),
    };
  }
  throw new Error(`Unexpected table in test: ${table}`);
});

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    },
    rpc: rpcMock,
    from: fromMock,
  })),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: () => ({ from: fromMock }),
}));

jest.mock("@/lib/events/invite-emails", () => ({
  sendEventInviteEmails: jest.fn(async () => ({})),
  sendOrganizerInviteEmails: jest.fn(async () => ({})),
}));

import { POST } from "./route";

const BASE_EVENT = {
  event_name: "Spam Event",
  event_date: "2026-12-01",
  location: "Online",
};

function postEvent(event: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: { ...BASE_EVENT, ...event } }),
    })
  );
}

function insertedPayload() {
  expect(insertMock).toHaveBeenCalledTimes(1);
  return insertMock.mock.calls[0][0];
}

describe("POST /api/events moderation columns", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    insertMock.mockClear();
    fromMock.mockClear();
    insertSingleMock.mockReset();
    insertSingleMock.mockResolvedValue({
      data: { event_id: "evt-1", event_name: "Spam Event", slug: null },
      error: null,
    });
  });

  describe("non-admin", () => {
    beforeEach(() => {
      rpcMock.mockResolvedValue({ data: false, error: null });
    });

    it("cannot self-approve, publish or feature an event", async () => {
      const res = await postEvent({
        visibility: "public",
        approval_status: "approved",
        featured: true,
      });

      expect(res.status).toBe(201);
      expect(rpcMock).toHaveBeenCalledWith("is_admin_user", {
        user_id: "user-1",
      });
      expect(insertedPayload()).toMatchObject({
        visibility: "draft",
        approval_status: "not_submitted",
        featured: false,
      });
    });

    it.each(["draft", "private"])("keeps %s visibility", async (visibility) => {
      await postEvent({ visibility });

      expect(insertedPayload().visibility).toBe(visibility);
    });

    it.each(["demo", "test", "archived"])(
      "falls back to draft for %s visibility",
      async (visibility) => {
        await postEvent({ visibility });

        expect(insertedPayload().visibility).toBe("draft");
      }
    );

    it.each(["submitted", "rejected"])(
      "ignores a client-supplied %s approval status",
      async (approval_status) => {
        await postEvent({ approval_status });

        expect(insertedPayload().approval_status).toBe("not_submitted");
      }
    );
  });

  it("treats a failed admin lookup as non-admin", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    await postEvent({
      visibility: "public",
      approval_status: "approved",
      featured: true,
    });

    expect(insertedPayload()).toMatchObject({
      visibility: "draft",
      approval_status: "not_submitted",
      featured: false,
    });
  });

  it("still lets an admin publish, approve and feature", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });

    const res = await postEvent({
      visibility: "public",
      approval_status: "approved",
      featured: true,
    });

    expect(res.status).toBe(201);
    expect(insertedPayload()).toMatchObject({
      visibility: "public",
      approval_status: "approved",
      featured: true,
    });
  });

  it("uses safe defaults for an admin who sends no moderation fields", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });

    await postEvent({});

    expect(insertedPayload()).toMatchObject({
      visibility: "draft",
      approval_status: "not_submitted",
      featured: false,
    });
  });
});
