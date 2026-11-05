/**
 * @jest-environment node
 */
import type { NextRequest } from "next/server";

import { POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const SLOT_ID = "123e4567-e89b-12d3-a456-426614174000";
// Raised by enforce_mentor_booking_capacity when a concurrent booking took the
// last place after this request's own count.
const SLOT_FULL_ERROR = { code: "45000", message: "Slot is fully booked" };

function makeRequest() {
  return {
    json: jest.fn().mockResolvedValue({ availability_id: SLOT_ID }),
  } as unknown as NextRequest;
}

function makeContext() {
  return { params: Promise.resolve({ eventId: "event-1" }) };
}

function mockClients({
  existing = null,
  activeCount = 0,
  writeResult = { data: { id: "booking-1" }, error: null },
}: {
  existing?: { id: string; status: string } | null;
  activeCount?: number;
  writeResult?: { data: unknown; error: unknown };
} = {}) {
  const insertBuilder = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(writeResult),
  };
  const roleBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest
      .fn()
      .mockResolvedValue({ data: { role: "participant" }, error: null }),
  };
  const userClient = {
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: jest.fn((table: string) =>
      table === "user_event_roles" ? roleBuilder : insertBuilder,
    ),
  };

  const slotBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: SLOT_ID,
        event_id: "event-1",
        mentor_id: "mentor-1",
        max_bookings: 1,
      },
      error: null,
    }),
  };
  const countResult = { count: activeCount, error: null };
  const bookingsBuilder: Record<string, jest.Mock> = {
    select: jest.fn((_columns: string, options?: { head?: boolean }) => {
      if (!options?.head) return bookingsBuilder;
      return {
        eq: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue(countResult),
        })),
      };
    }),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: existing, error: null }),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue(writeResult),
        })),
      })),
    })),
  };
  const serviceClient = {
    from: jest.fn((table: string) =>
      table === "mentor_availability" ? slotBuilder : bookingsBuilder,
    ),
  };

  (createSupabaseClient as jest.Mock).mockResolvedValue(userClient);
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(serviceClient);
  return { insertBuilder, bookingsBuilder };
}

describe("POST /api/events/[eventId]/mentor-bookings", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("books an open slot", async () => {
    const { insertBuilder } = mockClients();

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(201);
    expect(insertBuilder.insert).toHaveBeenCalled();
  });

  it("rejects a full slot before writing", async () => {
    const { insertBuilder } = mockClients({ activeCount: 1 });

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(409);
    expect(insertBuilder.insert).not.toHaveBeenCalled();
  });

  it("reports a full slot when a concurrent booking wins the insert", async () => {
    mockClients({ writeResult: { data: null, error: SLOT_FULL_ERROR } });

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Slot is fully booked",
    });
  });

  it("reports a full slot when a concurrent booking wins a re-booking", async () => {
    const { bookingsBuilder } = mockClients({
      existing: { id: "booking-1", status: "cancelled" },
      writeResult: { data: null, error: SLOT_FULL_ERROR },
    });

    const response = await POST(makeRequest(), makeContext());

    expect(bookingsBuilder.update).toHaveBeenCalled();
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Slot is fully booked",
    });
  });

  it("still reports other write failures as server errors", async () => {
    mockClients({
      writeResult: { data: null, error: { code: "XX000", message: "boom" } },
    });

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(500);
  });
});
