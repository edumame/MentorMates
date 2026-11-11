/** @jest-environment node */

import { NextRequest } from "next/server";
import { DELETE, PATCH } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { ApprovalStatus, EventVisibility } from "@/lib/types";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

const storageList = jest.fn();
const storageRemove = jest.fn();
jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: () => ({
    storage: { from: () => ({ list: storageList, remove: storageRemove }) },
  }),
}));

type RpcResult = { data?: unknown; error?: { code?: string; message?: string } | null };

function mockClient({
  user = { id: "user-1" },
  rpc = {},
  eventRow = { visibility: EventVisibility.Private },
  updateError = null,
  updatedRows = [{ event_id: "event-1" }],
}: {
  user?: { id: string } | null;
  rpc?: Record<string, RpcResult>;
  eventRow?: { visibility: EventVisibility; approval_status?: ApprovalStatus | null } | null;
  updateError?: { message: string } | null;
  updatedRows?: Array<{ event_id: string }>;
} = {}) {
  const updateBuilder = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: updateError ? null : updatedRows, error: updateError }),
    }),
  };
  const selectBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: eventRow, error: null }),
  };
  const from = jest.fn().mockImplementation((table: string) => {
    if (table !== "events") throw new Error(`Unexpected table ${table}`);
    return { ...selectBuilder, update: updateBuilder.update.mockReturnValue(updateBuilder) };
  });
  const rpcFn = jest.fn().mockImplementation((name: string) =>
    Promise.resolve({ data: null, error: null, ...(rpc[name] ?? {}) })
  );
  const client = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: "no session" },
      }),
    },
    rpc: rpcFn,
    from,
  };
  (createSupabaseClient as jest.Mock).mockResolvedValue(client);
  return { client, rpcFn, from, updateBuilder };
}

const params = { params: Promise.resolve({ eventId: "event-1" }) };
const deleteRequest = () =>
  new NextRequest("http://localhost/api/events/event-1", { method: "DELETE" });
const patchRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/events/event-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  jest.clearAllMocks();
  storageList.mockResolvedValue({ data: [], error: null });
  storageRemove.mockResolvedValue({ error: null });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("DELETE /api/events/[eventId]", () => {
  it("returns 401 without a session and never calls delete_event", async () => {
    const { rpcFn } = mockClient({ user: null });
    const res = await DELETE(deleteRequest(), params);
    expect(res.status).toBe(401);
    expect(rpcFn).not.toHaveBeenCalled();
  });

  it("deletes atomically via the delete_event RPC (no client-side table deletes)", async () => {
    const { rpcFn, from } = mockClient();
    const res = await DELETE(deleteRequest(), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(rpcFn).toHaveBeenCalledWith("delete_event", { p_event_id: "event-1" });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    ["42501", "forbidden", 403, "Forbidden"],
    ["P0002", "event not found", 404, "Event not found"],
    ["28000", "not authenticated", 401, "Unauthorized"],
  ])("maps SQLSTATE %s (%s) to HTTP %i", async (code, message, status, error) => {
    mockClient({ rpc: { delete_event: { error: { code, message } } } });
    const res = await DELETE(deleteRequest(), params);
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(error);
  });

  it("returns 409 and suggests archiving when the event has payments", async () => {
    mockClient({
      rpc: { delete_event: { error: { code: "P0001", message: "event_has_payments" } } },
    });
    const res = await DELETE(deleteRequest(), params);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("event_has_payments");
    expect(body.error).toMatch(/Archive it instead/);
  });

  it("does not leak raw database errors", async () => {
    mockClient({
      rpc: {
        delete_event: {
          error: {
            code: "23503",
            message:
              'update or delete on table "events" violates foreign key constraint "feedback_event_id_fkey"',
          },
        },
      },
    });
    const res = await DELETE(deleteRequest(), params);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to delete event. Nothing was changed.");
    expect(JSON.stringify(body)).not.toMatch(/foreign key/);
  });
});

describe("DELETE cover image cleanup (ORG-006 round 2)", () => {
  it("removes the event's cover objects after a successful delete", async () => {
    mockClient();
    storageList.mockResolvedValueOnce({ data: [{ name: "a.png" }, { name: "b.png" }], error: null });
    const res = await DELETE(deleteRequest(), params);
    expect(res.status).toBe(200);
    expect(storageList).toHaveBeenCalledWith("event-covers/event-1", { limit: 100 });
    expect(storageRemove).toHaveBeenCalledWith(["event-covers/event-1/a.png", "event-covers/event-1/b.png"]);
  });

  it("does not touch storage when the delete fails", async () => {
    mockClient({ rpc: { delete_event: { error: { code: "42501", message: "forbidden" } } } });
    await DELETE(deleteRequest(), params);
    expect(storageList).not.toHaveBeenCalled();
  });

  it("still reports success when storage cleanup fails", async () => {
    mockClient();
    storageList.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect((await DELETE(deleteRequest(), params)).status).toBe(200);
  });
});

describe("PATCH /api/events/[eventId]", () => {
  it("returns 403 when the user cannot manage the event", async () => {
    const { from } = mockClient({ rpc: { can_manage_event: { data: false } } });
    const res = await PATCH(patchRequest({ action: "archive" }), params);
    expect(res.status).toBe(403);
    expect(from).not.toHaveBeenCalled();
  });

  it("returns 403 when the permission check itself errors", async () => {
    mockClient({ rpc: { can_manage_event: { error: { message: "boom" } } } });
    const res = await PATCH(patchRequest({ action: "archive" }), params);
    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid or non-JSON body", async () => {
    mockClient({ rpc: { can_manage_event: { data: true } } });
    expect((await PATCH(patchRequest({ action: "explode" }), params)).status).toBe(400);
    mockClient({ rpc: { can_manage_event: { data: true } } });
    expect((await PATCH(patchRequest("not json"), params)).status).toBe(400);
  });

  it("archives a private event", async () => {
    const { updateBuilder } = mockClient({ rpc: { can_manage_event: { data: true } } });
    const res = await PATCH(patchRequest({ action: "archive" }), params);
    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith({ visibility: EventVisibility.Archived });
    expect((await res.json()).newVisibility).toBe(EventVisibility.Archived);
  });

  it("unarchives an archived event back to private", async () => {
    const { updateBuilder } = mockClient({
      rpc: { can_manage_event: { data: true } },
      eventRow: { visibility: EventVisibility.Archived },
    });
    const res = await PATCH(patchRequest({ action: "unarchive" }), params);
    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith({ visibility: EventVisibility.Private });
  });

  it("rejects archiving twice / unarchiving a non-archived event", async () => {
    mockClient({
      rpc: { can_manage_event: { data: true } },
      eventRow: { visibility: EventVisibility.Archived },
    });
    expect((await PATCH(patchRequest({ action: "archive" }), params)).status).toBe(400);
    mockClient({ rpc: { can_manage_event: { data: true } } });
    expect((await PATCH(patchRequest({ action: "unarchive" }), params)).status).toBe(400);
  });

  it("returns 404 when the event is not visible", async () => {
    mockClient({ rpc: { can_manage_event: { data: true } }, eventRow: null });
    expect((await PATCH(patchRequest({ action: "archive" }), params)).status).toBe(404);
  });

  it("returns 403 when RLS filtered the update (0 rows changed)", async () => {
    mockClient({ rpc: { can_manage_event: { data: true } }, updatedRows: [] });
    const res = await PATCH(patchRequest({ action: "archive" }), params);
    expect(res.status).toBe(403);
  });

  it("hides raw RLS errors on update failure", async () => {
    mockClient({
      rpc: { can_manage_event: { data: true } },
      updateError: { message: 'new row violates row-level security policy for table "events"' },
    });
    const res = await PATCH(patchRequest({ action: "archive" }), params);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to archive event");
  });
});

describe("PATCH withdraws a pending submission (audit-151)", () => {
  const canManage = { can_manage_event: { data: true } };

  it("withdraws a pending submission when the event is archived", async () => {
    const { updateBuilder } = mockClient({
      rpc: canManage,
      eventRow: { visibility: EventVisibility.Private, approval_status: ApprovalStatus.Submitted },
    });

    const response = await PATCH(patchRequest({ action: "archive" }), params);

    expect(response.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith({
      visibility: EventVisibility.Archived,
      approval_status: ApprovalStatus.NotSubmitted,
    });
    expect(await response.json()).toMatchObject({
      newVisibility: EventVisibility.Archived,
      approvalStatus: ApprovalStatus.NotSubmitted,
    });
  });

  it.each([ApprovalStatus.Approved, ApprovalStatus.Rejected, ApprovalStatus.NotSubmitted])(
    "keeps approval_status %s when archiving",
    async (approvalStatus) => {
      const { updateBuilder } = mockClient({
        rpc: canManage,
        eventRow: { visibility: EventVisibility.Public, approval_status: approvalStatus },
      });

      const response = await PATCH(patchRequest({ action: "archive" }), params);

      expect(response.status).toBe(200);
      expect(updateBuilder.update).toHaveBeenCalledWith({ visibility: EventVisibility.Archived });
      expect((await response.json()).approvalStatus).toBe(approvalStatus);
    }
  );

  it("does not change approval_status when unarchiving", async () => {
    const { updateBuilder } = mockClient({
      rpc: canManage,
      eventRow: { visibility: EventVisibility.Archived, approval_status: ApprovalStatus.Submitted },
    });

    const response = await PATCH(patchRequest({ action: "unarchive" }), params);

    expect(response.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith({ visibility: EventVisibility.Private });
  });
});
