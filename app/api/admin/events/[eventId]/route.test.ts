/** @jest-environment node */

import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventVisibility } from "@/lib/types";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

describe("PATCH /api/admin/events/[eventId]", () => {
  it("sets visibility to public when an event is approved", async () => {
    const currentEventBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { approval_status: "submitted" },
        error: null,
      }),
    };

    const updateEventBuilder = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          event_id: "event-1",
          approval_status: "approved",
          visibility: EventVisibility.Public,
        },
        error: null,
      }),
    };

    const approvalLogBuilder = {
      insert: jest.fn().mockResolvedValue({ error: null }),
    };

    let eventsFromCalls = 0;
    const from = jest.fn().mockImplementation((table: string) => {
      if (table === "events") {
        eventsFromCalls += 1;
        return eventsFromCalls === 1 ? currentEventBuilder : updateEventBuilder;
      }

      if (table === "event_approval_logs") {
        return approvalLogBuilder;
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "admin-user-1" } },
          error: null,
        }),
      },
      rpc: jest.fn().mockResolvedValue({ data: true }),
      from,
    });

    const request = new NextRequest("http://localhost/api/admin/events/event-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_status: "approved" }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ eventId: "event-1" }),
    });

    expect(response.status).toBe(200);
    expect(updateEventBuilder.update).toHaveBeenCalledWith({
      approval_status: "approved",
      rejection_reason: null,
      visibility: EventVisibility.Public,
    });
  });
});
