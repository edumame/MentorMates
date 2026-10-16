/** @jest-environment node */

import { POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendEventInviteEmails, sendOrganizerInviteEmails } from "@/lib/events/invite-emails";
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

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("@/lib/events/invite-emails", () => ({
  sendEventInviteEmails: jest.fn().mockResolvedValue({
    sent: { participant: [], judge: [] },
    failed: { participant: [], judge: [] },
    deferred: true,
  }),
  sendOrganizerInviteEmails: jest.fn().mockResolvedValue({
    sent: { existing: [], new: [] },
    failed: { existing: [], new: [] },
  }),
}));

describe("POST /api/events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists max_projects from the wizard payload into the event insert", async () => {
    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            event_id: "event-1",
            event_name: "Hack Night",
            slug: "hack-night",
            visibility: EventVisibility.Draft,
          },
          error: null,
        }),
      }),
    });

    const upsert = jest.fn().mockResolvedValue({ error: null });
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        display_name: "Casey Organizer",
        email: "casey@example.com",
      },
    });

    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "casey@example.com",
            },
          },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "events") {
          return { insert };
        }

        if (table === "user_event_roles") {
          return { upsert };
        }

        if (table === "user_profiles") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      })),
    });

    const response = await POST(
      new Request("https://mentormates.ai/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: {
            event_name: "Hack Night",
            event_date: "2026-04-18",
            location: "Online",
            visibility: EventVisibility.Draft,
            approval_status: ApprovalStatus.NotSubmitted,
            max_projects: 15,
          },
          organizerEmails: ["casey@example.com"],
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "Hack Night",
        max_projects: 15,
        owner_id: "user-1",
      })
    );
    expect(sendOrganizerInviteEmails).toHaveBeenCalled();
    expect(sendEventInviteEmails).toHaveBeenCalled();
  });
});
