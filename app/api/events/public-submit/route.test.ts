/**
 * @jest-environment node
 */

const insertSingleMock = jest.fn();
import type { Database } from "@/lib/database.types";

const insertMock = jest.fn<
  { select: () => { single: typeof insertSingleMock } },
  [Database["public"]["Tables"]["events"]["Insert"]]
>(() => ({
  select: jest.fn(() => ({
    single: insertSingleMock,
  })),
}));
const submissionInsertMock = jest.fn<
  Promise<{ error: { message: string } | null }>,
  [Database["public"]["Tables"]["event_submissions"]["Insert"]]
>(async () => ({ error: null }));
const deleteEqMock = jest.fn(async () => ({ error: null }));
const deleteMock = jest.fn(() => ({ eq: deleteEqMock }));
const fromMock = jest.fn((table: string) =>
  table === "event_submissions"
    ? { insert: submissionInsertMock }
    : { insert: insertMock, delete: deleteMock }
);

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  })),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: () => ({ from: fromMock }),
}));

jest.mock("@/lib/email/send-event-approval-notification", () => ({
  sendEventApprovalNotification: jest.fn(() => Promise.resolve({ sent: 1, failed: 0 })),
}));

import { POST } from "./route";

const VALID_PAYLOAD = {
  submitter_name: "Sample Submitter",
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
    submissionInsertMock.mockClear();
    deleteMock.mockClear();
    deleteEqMock.mockClear();
  });

  it("stores the submission as draft (not publicly reachable or redirecting) until admin approval", async () => {
    insertSingleMock.mockResolvedValueOnce({ data: { event_id: "evt-1" }, error: null });

    const res = await POST(
      makeRequest({ ...VALID_PAYLOAD, link: "https://phish.example.test/login" })
    );

    expect(res.status).toBe(201);
    const insertPayload = insertMock.mock.calls[0][0];
    expect(insertPayload.visibility).toBe("draft");
    expect(insertPayload.approval_status).toBe("submitted");
  });

  it("keeps submitter contact details off the public events row", async () => {
    insertSingleMock.mockResolvedValueOnce({ data: { event_id: "evt-2" }, error: null });

    await POST(makeRequest({ ...VALID_PAYLOAD, affiliation: "Example U", expected_attendance: 50 }));

    const insertPayload = insertMock.mock.calls[0][0];
    expect(insertPayload).not.toHaveProperty("submitter_email");
    expect(insertPayload).not.toHaveProperty("submitter_name");
    expect(insertPayload).not.toHaveProperty("organizer_affiliation");
    expect(insertPayload).not.toHaveProperty("expected_attendance");
    expect(submissionInsertMock).toHaveBeenCalledWith({
      event_id: "evt-2",
      submitter_email: "submitter@example.com",
      submitter_name: "Sample Submitter",
      organizer_affiliation: "Example U",
      expected_attendance: 50,
    });
  });

  it("removes the event and returns 500 when the contact row cannot be stored", async () => {
    insertSingleMock.mockResolvedValueOnce({ data: { event_id: "evt-3" }, error: null });
    submissionInsertMock.mockResolvedValueOnce({ error: { message: "boom" } });

    const res = await POST(makeRequest(VALID_PAYLOAD));

    expect(res.status).toBe(500);
    expect(deleteMock).toHaveBeenCalled();
    expect(deleteEqMock).toHaveBeenCalledWith("event_id", "evt-3");
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

  it.each([undefined, ""])("rejects missing or empty submitter_name (%s) before inserting", async (submitter_name) => {
    const response = await POST(makeRequest({ ...VALID_PAYLOAD, submitter_name }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.details.fieldErrors.submitter_name).toContain(
      submitter_name === undefined ? "Required" : "Name is required",
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it.each(["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,hi"])(
    "rejects non-http(s) link %p before inserting (PUB-001)",
    async (link) => {
      const res = await POST(makeRequest({ ...VALID_PAYLOAD, link }));
      expect(res.status).toBe(400);
      expect(insertMock).not.toHaveBeenCalled();
    }
  );

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
