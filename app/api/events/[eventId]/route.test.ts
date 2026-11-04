/** @jest-environment node */

import { NextRequest } from "next/server";
import { DELETE } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

const EVENT_ID = "event-1";

type RpcResult = { data?: unknown; error: { code: string; message: string } | null };

// Records every write so a test can prove nothing was removed outside the RPC.
function setup({
  role = "organizer",
  deleteResult = { data: null, error: null },
}: {
  role?: string | null;
  deleteResult?: RpcResult;
} = {}) {
  const directDeletes: string[] = [];
  const rpc = jest.fn().mockImplementation((name: string) => {
    if (name === "is_admin_user") {
      return Promise.resolve({ data: false, error: null });
    }
    return Promise.resolve(deleteResult);
  });

  const from = jest.fn().mockImplementation((table: string) => {
    const builder: Record<string, jest.Mock> = {};
    const row =
      table === "user_event_roles"
        ? role && { role }
        : { event_id: EVENT_ID };
    for (const method of ["select", "eq", "in"]) {
      builder[method] = jest.fn().mockReturnValue(builder);
    }
    builder.delete = jest.fn().mockImplementation(() => {
      directDeletes.push(table);
      return builder;
    });
    builder.maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: row, error: null });
    builder.then = jest
      .fn()
      .mockImplementation((resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: [{ track_id: "track-1", id: "prize-1" }], error: null }).then(
          resolve
        )
      );
    return builder;
  });

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from,
    rpc,
  });

  return { directDeletes, rpc };
}

function callDelete() {
  return DELETE(
    new NextRequest(`http://localhost/api/events/${EVENT_ID}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ eventId: EVENT_ID }) }
  );
}

describe("DELETE /api/events/[eventId]", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("deletes the event in one transactional RPC, with no separate table deletes", async () => {
    const { directDeletes, rpc } = setup();

    const response = await callDelete();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("delete_event_with_related", {
      p_event_id: EVENT_ID,
    });
    expect(directDeletes).toEqual([]);
  });

  it("refuses with 409 and destroys nothing when related rows block the delete", async () => {
    const { directDeletes } = setup({
      deleteResult: {
        error: {
          code: "23503",
          message:
            'update or delete on table "events" violates foreign key constraint "feedback_event_id_fkey"',
        },
      },
    });

    const response = await callDelete();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("Nothing was deleted");
    expect(body.error).not.toContain("foreign key");
    expect(directDeletes).toEqual([]);
  });

  it("does not report success when the database did not delete the event", async () => {
    const { directDeletes } = setup({
      deleteResult: {
        error: { code: "42501", message: "Not allowed to delete event" },
      },
    });

    const response = await callDelete();

    expect(response.status).toBe(403);
    expect(directDeletes).toEqual([]);
  });

  it("returns a generic 500 for any other database failure", async () => {
    const { directDeletes } = setup({
      deleteResult: { error: { code: "XX000", message: "internal detail" } },
    });

    const response = await callDelete();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to delete event",
    });
    expect(directDeletes).toEqual([]);
  });

  it("rejects a user without organizer access before calling the RPC", async () => {
    const { directDeletes, rpc } = setup({ role: "participant" });

    const response = await callDelete();

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalledWith(
      "delete_event_with_related",
      expect.anything()
    );
    expect(directDeletes).toEqual([]);
  });
});
