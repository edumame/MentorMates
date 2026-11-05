/**
 * @jest-environment node
 */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { signCheckinQR } from "@/lib/checkin/qr-signature";
import { EventRole } from "@/lib/types";
import * as checkinRoute from "./route";

jest.mock("server-only", () => ({}), { virtual: true });

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const mockCreateSupabaseServiceClient =
  createSupabaseServiceClient as jest.Mock;

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const ATTENDEE_ID = "22222222-2222-4222-8222-222222222222";
const STAFF_ID = "33333333-3333-4333-8333-333333333333";
const FIRST_SCAN_AT = "2026-11-04T09:00:00.000Z";

const OTHER_ID = "44444444-4444-4444-8444-444444444444";
const SECRET = "test-checkin-secret";

const signedQuery = (eventId = EVENT_ID, userId = ATTENDEE_ID) =>
  `evt=${eventId}&usr=${userId}&sig=${signCheckinQR(eventId, userId)}`;

const scan = (query = signedQuery()) =>
  checkinRoute.POST(
    new Request(`http://localhost/api/checkin?${query}`, { method: "POST" })
  );

function mockCaller({
  user = { id: STAFF_ID },
  role = EventRole.Organizer,
  isAdmin = false,
}: {
  user?: { id: string } | null;
  role?: EventRole | null;
  isAdmin?: boolean;
}) {
  const roleQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest
      .fn()
      .mockResolvedValue({ data: role ? { role } : null, error: null }),
  };

  mockCreateSupabaseClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    from: jest.fn(() => roleQuery),
    rpc: jest.fn().mockResolvedValue({ data: isAdmin, error: null }),
  });

  return roleQuery;
}

function mockRecord(result: { data: unknown; error: unknown }) {
  const rpc = jest.fn().mockResolvedValue(result);
  mockCreateSupabaseServiceClient.mockReturnValue({ rpc });
  return rpc;
}

describe("/api/checkin", () => {
  let recordCheckin: jest.Mock;
  const originalSecret = process.env.CHECKIN_QR_SECRET;

  afterAll(() => {
    process.env.CHECKIN_QR_SECRET = originalSecret;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CHECKIN_QR_SECRET = SECRET;
    recordCheckin = mockRecord({
      data: [{ outcome: "checked_in", recorded_at: FIRST_SCAN_AT }],
      error: null,
    });
  });

  it("does not change state on GET, which links and prefetches can trigger", () => {
    expect(checkinRoute).not.toHaveProperty("GET");
  });

  it("rejects a caller who is not signed in", async () => {
    mockCaller({ user: null });

    const response = await scan();

    expect(response.status).toBe(401);
    expect(recordCheckin).not.toHaveBeenCalled();
  });

  it.each([EventRole.Participant, EventRole.Mentor, EventRole.Judge])(
    "rejects a %s of the event",
    async (role) => {
      mockCaller({ role });

      const response = await scan();

      expect(response.status).toBe(403);
      expect(recordCheckin).not.toHaveBeenCalled();
    }
  );

  it("rejects a signed-in user with no role in the scanned event", async () => {
    const roleQuery = mockCaller({ role: null });

    const response = await scan();

    expect(response.status).toBe(403);
    expect(recordCheckin).not.toHaveBeenCalled();
    expect(roleQuery.eq).toHaveBeenCalledWith("event_id", EVENT_ID);
    expect(roleQuery.eq).toHaveBeenCalledWith("user_id", STAFF_ID);
  });

  it("records the first scan by an event organizer", async () => {
    mockCaller({ role: EventRole.Organizer });

    const response = await scan();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Successfully checked in",
      timestamp: FIRST_SCAN_AT,
    });
    expect(recordCheckin).toHaveBeenCalledTimes(1);
    expect(recordCheckin).toHaveBeenCalledWith("record_event_checkin", {
      p_event_id: EVENT_ID,
      p_user_id: ATTENDEE_ID,
      p_checked_in_by: STAFF_ID,
    });
  });

  it("lets a platform admin with no event role check people in", async () => {
    mockCaller({ role: null, isAdmin: true });

    const response = await scan();

    expect(response.status).toBe(200);
    expect(recordCheckin).toHaveBeenCalledTimes(1);
  });

  it("flags a repeat scan with the time of the first scan", async () => {
    mockCaller({});
    recordCheckin = mockRecord({
      data: [{ outcome: "already_checked_in", recorded_at: FIRST_SCAN_AT }],
      error: null,
    });

    const response = await scan();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Already checked in",
      timestamp: FIRST_SCAN_AT,
    });
  });

  it("rejects an attendee who is not registered for the event", async () => {
    mockCaller({});
    recordCheckin = mockRecord({
      data: [{ outcome: "not_registered", recorded_at: null }],
      error: null,
    });

    const response = await scan();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "User is not registered for this event",
    });
  });

  it.each([
    ["no ids", ""],
    ["a missing user id", `evt=${EVENT_ID}`],
    ["a malformed event id", `evt=not-a-uuid&usr=${ATTENDEE_ID}`],
    ["a malformed user id", `evt=${EVENT_ID}&usr=not-a-uuid`],
  ])("rejects a QR code with %s", async (_label, query) => {
    mockCaller({});

    const response = await scan(query);

    expect(response.status).toBe(400);
    expect(recordCheckin).not.toHaveBeenCalled();
  });

  describe("forged QR codes", () => {
    const flipLastCharacter = (value: string) =>
      `${value.slice(0, -1)}${value.endsWith("0") ? "1" : "0"}`;

    it.each<[string, () => string]>([
      ["no signature", () => `evt=${EVENT_ID}&usr=${ATTENDEE_ID}`],
      ["an empty signature", () => `evt=${EVENT_ID}&usr=${ATTENDEE_ID}&sig=`],
      [
        "a tampered signature",
        () =>
          `evt=${EVENT_ID}&usr=${ATTENDEE_ID}&sig=${flipLastCharacter(
            signCheckinQR(EVENT_ID, ATTENDEE_ID)
          )}`,
      ],
      [
        "a truncated signature",
        () =>
          `evt=${EVENT_ID}&usr=${ATTENDEE_ID}&sig=${signCheckinQR(
            EVENT_ID,
            ATTENDEE_ID
          ).slice(0, 32)}`,
      ],
      [
        "a non-ASCII signature of the same length",
        () =>
          `evt=${EVENT_ID}&usr=${ATTENDEE_ID}&sig=${encodeURIComponent(
            "é".repeat(64)
          )}`,
      ],
      [
        "another attendee's signature",
        () =>
          `evt=${EVENT_ID}&usr=${ATTENDEE_ID}&sig=${signCheckinQR(
            EVENT_ID,
            OTHER_ID
          )}`,
      ],
      [
        "the attendee's signature from another event",
        () =>
          `evt=${EVENT_ID}&usr=${ATTENDEE_ID}&sig=${signCheckinQR(
            OTHER_ID,
            ATTENDEE_ID
          )}`,
      ],
      [
        "the ids swapped under a valid signature",
        () =>
          `evt=${ATTENDEE_ID}&usr=${EVENT_ID}&sig=${signCheckinQR(
            EVENT_ID,
            ATTENDEE_ID
          )}`,
      ],
    ])("rejects valid ids with %s", async (_label, buildQuery) => {
      mockCaller({ role: EventRole.Organizer });

      const response = await scan(buildQuery());

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid check-in QR code",
      });
      expect(recordCheckin).not.toHaveBeenCalled();
    });

    it("rejects a signature made with a different secret", async () => {
      mockCaller({ role: EventRole.Organizer });
      process.env.CHECKIN_QR_SECRET = "attacker-guess";
      const query = signedQuery();
      process.env.CHECKIN_QR_SECRET = SECRET;

      const response = await scan(query);

      expect(response.status).toBe(400);
      expect(recordCheckin).not.toHaveBeenCalled();
    });

    it("reports a server error, not a bad ticket, when the secret is unset", async () => {
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      mockCaller({ role: EventRole.Organizer });
      const query = signedQuery();
      delete process.env.CHECKIN_QR_SECRET;

      const response = await scan(query);

      expect(response.status).toBe(500);
      expect(recordCheckin).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  it.each([
    ["the write fails", { data: null, error: { message: "boom" } }],
    ["the write returns nothing", { data: [], error: null }],
  ])("never reports success when %s", async (_label, result) => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockCaller({});
    mockRecord(result);

    const response = await scan();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to process check-in",
    });
    consoleError.mockRestore();
  });
});
