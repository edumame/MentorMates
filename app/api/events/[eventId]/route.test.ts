/** @jest-environment node */

import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { ApprovalStatus, EventRole, EventVisibility } from "@/lib/types";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

function mockClient(currentEvent: {
  visibility: EventVisibility;
  approval_status: ApprovalStatus | null;
}) {
  const roleBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: { role: EventRole.Organizer },
      error: null,
    }),
  };
  const readEventBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: currentEvent,
      error: null,
    }),
  };
  const updateEventBuilder = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null }),
  };

  let eventsFromCalls = 0;
  const from = jest.fn().mockImplementation((table: string) => {
    if (table === "user_event_roles") return roleBuilder;
    if (table === "events") {
      eventsFromCalls += 1;
      return eventsFromCalls === 1 ? readEventBuilder : updateEventBuilder;
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "organizer-1" } },
        error: null,
      }),
    },
    rpc: jest.fn().mockResolvedValue({ data: false }),
    from,
  });

  return { updateEventBuilder };
}

function patchEvent(action: "archive" | "unarchive") {
  return PATCH(
    new NextRequest("http://localhost/api/events/event-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }),
    { params: Promise.resolve({ eventId: "event-1" }) },
  );
}

describe("PATCH /api/events/[eventId]", () => {
  it("withdraws a pending submission when the event is archived", async () => {
    const { updateEventBuilder } = mockClient({
      visibility: EventVisibility.Private,
      approval_status: ApprovalStatus.Submitted,
    });

    const response = await patchEvent("archive");

    expect(response.status).toBe(200);
    expect(updateEventBuilder.update).toHaveBeenCalledWith({
      visibility: EventVisibility.Archived,
      approval_status: ApprovalStatus.NotSubmitted,
    });
    expect(await response.json()).toMatchObject({
      newVisibility: EventVisibility.Archived,
      approvalStatus: ApprovalStatus.NotSubmitted,
    });
  });

  it.each([
    ApprovalStatus.Approved,
    ApprovalStatus.Rejected,
    ApprovalStatus.NotSubmitted,
  ])("keeps approval_status %s when archiving", async (approvalStatus) => {
    const { updateEventBuilder } = mockClient({
      visibility: EventVisibility.Public,
      approval_status: approvalStatus,
    });

    const response = await patchEvent("archive");

    expect(response.status).toBe(200);
    expect(updateEventBuilder.update).toHaveBeenCalledWith({
      visibility: EventVisibility.Archived,
    });
    expect((await response.json()).approvalStatus).toBe(approvalStatus);
  });

  it("does not change approval_status when unarchiving", async () => {
    const { updateEventBuilder } = mockClient({
      visibility: EventVisibility.Archived,
      approval_status: ApprovalStatus.Submitted,
    });

    const response = await patchEvent("unarchive");

    expect(response.status).toBe(200);
    expect(updateEventBuilder.update).toHaveBeenCalledWith({
      visibility: EventVisibility.Private,
    });
  });
});
