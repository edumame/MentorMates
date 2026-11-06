/** @jest-environment node */

import { POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { sendEventApprovalNotification } from "@/lib/email/send-event-approval-notification";
import { ApprovalStatus, EventVisibility } from "@/lib/types";

jest.mock("next/server", () => {
  class MockNextResponse {
    status: number;
    private readonly body: unknown;

    constructor(body: unknown, init?: ResponseInit) {
      this.status = init?.status ?? 200;
      this.body = body;
    }

    static json(body: unknown, init?: ResponseInit) {
      return new MockNextResponse(body, init);
    }

    async json() {
      return this.body;
    }
  }

  return { NextResponse: MockNextResponse };
});

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/email/send-event-approval-notification", () => ({
  sendEventApprovalNotification: jest.fn().mockResolvedValue(undefined),
}));

describe("POST /api/events/request-approval", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates an existing private event instead of inserting a new one", async () => {
    const eventsSelectQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          event_id: "11111111-1111-4111-8111-111111111111",
          owner_id: "user-1",
          approval_status: ApprovalStatus.NotSubmitted,
          visibility: EventVisibility.Private,
        },
        error: null,
      }),
    };

    const updateSingle = jest.fn().mockResolvedValue({
      data: {
        event_id: "11111111-1111-4111-8111-111111111111",
        event_name: "Updated Hack Night",
        slug: "updated-hack-night",
        event_date: "2026-04-18",
        location: "Online",
        approval_status: ApprovalStatus.Submitted,
      },
      error: null,
    });
    const eventsUpdateQuery = {
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: updateSingle,
          }),
        }),
      }),
    };

    const approvalLogInsert = jest.fn().mockResolvedValue({ error: null });
    let eventsFromCallCount = 0;

    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "owner@example.com",
              user_metadata: {
                full_name: "Owner User",
              },
            },
          },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "events") {
          eventsFromCallCount += 1;
          return eventsFromCallCount === 1 ? eventsSelectQuery : eventsUpdateQuery;
        }

        if (table === "event_approval_logs") {
          return {
            insert: approvalLogInsert,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await POST(
      new Request("https://mentormates.ai/api/events/request-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: "11111111-1111-4111-8111-111111111111",
          event: {
            event_name: "Updated Hack Night",
            event_date: "2026-04-18",
            location: "Online",
            max_projects: 12,
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(eventsUpdateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "Updated Hack Night",
        event_date: "2026-04-18",
        location: "Online",
        max_projects: 12,
        approval_status: ApprovalStatus.Submitted,
      })
    );
    expect(approvalLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: "11111111-1111-4111-8111-111111111111",
        previous_status: ApprovalStatus.NotSubmitted,
        new_status: ApprovalStatus.Submitted,
      })
    );
    expect(sendEventApprovalNotification).toHaveBeenCalled();
  });
});
