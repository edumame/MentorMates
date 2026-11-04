/** @jest-environment node */

import { GET } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
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
  sendEventInviteEmails: jest.fn(),
  sendOrganizerInviteEmails: jest.fn(),
}));

function mockAnonymousClient(rows: Record<string, unknown>[]) {
  const eq = jest.fn().mockResolvedValue({ data: rows, error: null });
  const inFilter = jest.fn().mockReturnValue({ eq });
  const select = jest.fn().mockReturnValue({ in: inFilter });
  const from = jest.fn().mockReturnValue({ select });

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    },
    from,
  });

  return { from, select, inFilter, eq };
}

describe("GET /api/events (signed out)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("selects the columns the landing-page event cards display", async () => {
    const { select } = mockAnonymousClient([]);

    await GET();

    const columns = (select.mock.calls[0][0] as string)
      .split(",")
      .map((column) => column.trim());

    expect(columns).toEqual(
      expect.arrayContaining([
        "event_id",
        "event_name",
        "slug",
        "event_blurb",
        "event_description",
        "location",
        "cover_image_url",
        "event_date",
        "featured",
      ])
    );
  });

  it("still limits results to approved public and private events", async () => {
    const rows = [{ event_id: "event-1", location: "Boston, MA" }];
    const { from, inFilter, eq } = mockAnonymousClient(rows);

    const response = await GET();

    expect(from).toHaveBeenCalledWith("events");
    expect(inFilter).toHaveBeenCalledWith("visibility", [
      EventVisibility.Public,
      EventVisibility.Private,
    ]);
    expect(eq).toHaveBeenCalledWith("approval_status", ApprovalStatus.Approved);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ events: rows });
  });
});
