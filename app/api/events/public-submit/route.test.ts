/**
 * @jest-environment node
 */

const insertSingleMock = jest.fn();
const insertMock = jest.fn(() => ({
  select: jest.fn(() => ({
    single: insertSingleMock,
  })),
}));
const fromMock = jest.fn(() => ({
  insert: insertMock,
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: () => ({ from: fromMock }),
}));

jest.mock("@/lib/email/send-event-approval-notification", () => ({
  sendEventApprovalNotification: jest.fn(() => Promise.resolve({ sent: 1, failed: 0 })),
}));

import { POST } from "./route";

const VALID_PAYLOAD = {
  email: "submitter@example.com",
  event_name: "Sample Demo Day",
  start_datetime: "2026-08-01T18:00:00Z",
  end_datetime: "2026-08-01T21:00:00Z",
  location: "San Francisco",
  link: "https://luma.com/sample-demo",
  want_featured: false,
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/events/public-submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/events/public-submit", () => {
  beforeEach(() => {
    insertSingleMock.mockReset();
    insertMock.mockClear();
    fromMock.mockClear();
  });

  it("populates NOT NULL columns ('rules') so the DB insert does not fail with 23502", async () => {
    insertSingleMock.mockResolvedValueOnce({
      data: { event_id: "evt-uuid-456" },
      error: null,
    });

    await POST(makeRequest(VALID_PAYLOAD));

    expect(insertMock).toHaveBeenCalledTimes(1);
    const insertPayload = insertMock.mock.calls[0][0];
    // events.rules is NOT NULL — the insert must include it (even as an empty array)
    expect(insertPayload).toHaveProperty("rules");
    expect(Array.isArray(insertPayload.rules)).toBe(true);
  });

  it("accepts a valid anonymous submission and returns 201 with event_id", async () => {
    insertSingleMock.mockResolvedValueOnce({
      data: { event_id: "evt-uuid-123" },
      error: null,
    });

    const res = await POST(makeRequest(VALID_PAYLOAD));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, event_id: "evt-uuid-123" });
    expect(fromMock).toHaveBeenCalledWith("events");
  });

  it("returns 400 when email is malformed", async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when end_datetime is before start_datetime", async () => {
    const res = await POST(
      makeRequest({
        ...VALID_PAYLOAD,
        start_datetime: "2026-08-01T21:00:00Z",
        end_datetime: "2026-08-01T18:00:00Z",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/end.*on or after.*start/i);
  });

  it("returns 500 when supabase insert fails (e.g. missing column from un-run migration)", async () => {
    insertSingleMock.mockResolvedValueOnce({
      data: null,
      error: {
        message: "column \"submitter_email\" does not exist",
        code: "42703",
      },
    });

    const res = await POST(makeRequest(VALID_PAYLOAD));
    expect(res.status).toBe(500);
  });
});
