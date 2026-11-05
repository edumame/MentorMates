/**
 * @jest-environment node
 */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { sendEventApprovalNotification } from "@/lib/email/send-event-approval-notification";
import { getEventApprovalRequestEmailTemplate } from "@/lib/email_templates/event-approval-request";
import { EventVisibility } from "@/lib/types";
import { POST } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(() => ({})),
}));

jest.mock("@/lib/email/send-event-approval-notification", () => ({
  sendEventApprovalNotification: jest.fn(() =>
    Promise.resolve({ sent: 1, failed: 0 }),
  ),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";

const savedEvent = {
  event_id: EVENT_ID,
  event_name: "Hack Night",
  event_date: "2026-08-01T18:00:00Z",
  location: "San Francisco",
  slug: "old-slug",
};

// Each events query ends in single(), so results are queued in call order.
function mockSupabase(eventResults: unknown[]) {
  const single = jest.fn();
  eventResults.forEach((data) =>
    single.mockResolvedValueOnce({ data, error: null }),
  );

  const eventsTable = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    single,
  };

  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: USER_ID, email: "casey@mentormates.ai" } },
        error: null,
      }),
    },
    from: jest.fn((table: string) => {
      if (table === "events") return eventsTable;
      if (table === "user_event_roles") {
        return { upsert: jest.fn().mockResolvedValue({ error: null }) };
      }
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    }),
  });
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/events/request-approval", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function emailedHtml() {
  const [data] = (sendEventApprovalNotification as jest.Mock).mock.calls[0];
  return getEventApprovalRequestEmailTemplate(data).html;
}

// An event can be renamed while it awaits approval, so the admin's link must
// not depend on the slug.
describe("POST /api/events/request-approval approval email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("links by event id when an existing event with a slug is submitted", async () => {
    mockSupabase([
      {
        event_id: EVENT_ID,
        owner_id: USER_ID,
        approval_status: null,
        visibility: EventVisibility.Private,
      },
      savedEvent,
    ]);

    const response = await POST(makeRequest({ eventId: EVENT_ID }));

    expect(response.status).toBe(200);
    expect(sendEventApprovalNotification).toHaveBeenCalledTimes(1);
    expect(emailedHtml()).toContain(`/events/${EVENT_ID}/overview`);
    expect(emailedHtml()).not.toContain("old-slug");
  });

  it("links by event id when a new event with a slug is created", async () => {
    mockSupabase([savedEvent]);

    const response = await POST(
      makeRequest({
        event: {
          event_name: "Hack Night",
          event_date: "2026-08-01T18:00:00Z",
          location: "San Francisco",
          slug: "old-slug",
        },
      }),
    );

    expect(response.status).toBe(201);
    expect(sendEventApprovalNotification).toHaveBeenCalledTimes(1);
    expect(emailedHtml()).toContain(`/events/${EVENT_ID}/overview`);
    expect(emailedHtml()).not.toContain("old-slug");
  });
});
