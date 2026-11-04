/** @jest-environment node */

import { fetchClientSecret } from "./stripe";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe/stripe";
import { EventRole } from "@/lib/types";
import { releaseParticipantSeatReservation } from "@/lib/events/participant-access";
import { createSeatStore } from "@/lib/events/__fixtures__/seat-store";

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Map([["origin", "https://example.test"]])),
}));

jest.mock("@/lib/stripe/stripe", () => ({
  stripe: {
    customers: { create: jest.fn() },
    checkout: { sessions: { create: jest.fn() } },
  },
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

type QueryResult = { data: unknown; error: unknown };

function query(result: QueryResult) {
  const builder: Record<string, unknown> = {
    then: (
      resolve: (value: QueryResult) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
  };

  for (const method of ["select", "eq", "order", "range", "upsert"]) {
    builder[method] = jest.fn(() => builder);
  }

  return builder;
}

function clientWith(tables: Record<string, QueryResult>) {
  return {
    from: jest.fn((table: string) => {
      if (!tables[table]) {
        throw new Error(`Unexpected table: ${table}`);
      }
      return query(tables[table]);
    }),
  };
}

const checkoutOptions = {
  eventId: "event-1",
  eventSlug: "event-1",
  eventName: "Paid Event",
  pricingTierId: "tier-1",
};

describe("fetchClientSecret capacity check", () => {
  const createSession = stripe.checkout.sessions.create as jest.Mock;

  const mockSeats = ({
    capacity,
    roles,
    approved,
    eventError = null,
  }: {
    capacity: number | null;
    roles: string[];
    approved: string[];
    eventError?: unknown;
  }) => {
    (createSupabaseServiceClient as jest.Mock).mockReturnValue(
      clientWith({
        events: {
          data: eventError
            ? null
            : { participant_capacity: capacity, paid: true },
          error: eventError,
        },
        user_event_roles: {
          data: roles.map((user_id) => ({ user_id, role: "participant" })),
          error: null,
        },
        participant_approval_requests: {
          data: approved.map((user_id) => ({ user_id })),
          error: null,
        },
      }),
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (createSupabaseClient as jest.Mock).mockResolvedValue({
      ...clientWith({
        user_profiles: { data: { stripe_customer_id: "cus_1" }, error: null },
        pricing_tiers: {
          data: { stripe_price_id: "price_1", available_until: null },
          error: null,
        },
        user_event_payments: { data: [{ id: "payment-1" }], error: null },
      }),
      auth: {
        getUser: jest.fn(async () => ({ data: { user: { id: "bob" } } })),
      },
    });

    createSession.mockResolvedValue({
      id: "cs_1",
      client_secret: "secret_1",
      payment_intent: null,
      amount_total: 1000,
      currency: "usd",
    });
  });

  it("does not create a Stripe session when every seat is taken", async () => {
    mockSeats({ capacity: 1, roles: ["alice"], approved: [] });

    await expect(fetchClientSecret(checkoutOptions)).rejects.toThrow(
      "Event is full. No seats available.",
    );
    expect(createSession).not.toHaveBeenCalled();
  });

  it("does not sell a seat held by another approved user", async () => {
    mockSeats({ capacity: 1, roles: [], approved: ["alice"] });

    await expect(fetchClientSecret(checkoutOptions)).rejects.toThrow(
      "Event is full. No seats available.",
    );
    expect(createSession).not.toHaveBeenCalled();
  });

  it("lets an approved user pay for their own held seat", async () => {
    mockSeats({ capacity: 1, roles: [], approved: ["bob"] });

    await expect(fetchClientSecret(checkoutOptions)).resolves.toBe("secret_1");
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it("sells the seat again once the approved holder has left", async () => {
    const store = createSeatStore({
      participantCapacity: 1,
      paid: true,
      requests: { alice: "approved" },
    });
    (createSupabaseServiceClient as jest.Mock).mockReturnValue(store.client);

    await expect(
      fetchClientSecret({ ...checkoutOptions, eventId: store.eventId }),
    ).rejects.toThrow("Event is full. No seats available.");

    await releaseParticipantSeatReservation(store.client, {
      eventId: store.eventId,
      userId: "alice",
    });

    await expect(
      fetchClientSecret({ ...checkoutOptions, eventId: store.eventId }),
    ).resolves.toBe("secret_1");
  });

  it("allows checkout when the event has no capacity limit", async () => {
    mockSeats({ capacity: null, roles: ["alice"], approved: [] });

    await expect(fetchClientSecret(checkoutOptions)).resolves.toBe("secret_1");
  });

  it("does not apply the participant limit to paying mentors", async () => {
    mockSeats({ capacity: 1, roles: ["alice"], approved: [] });

    await expect(
      fetchClientSecret({ ...checkoutOptions, role: EventRole.Mentor }),
    ).resolves.toBe("secret_1");
  });

  it("does not take payment when capacity cannot be verified", async () => {
    mockSeats({
      capacity: 1,
      roles: [],
      approved: [],
      eventError: { message: "boom" },
    });

    await expect(fetchClientSecret(checkoutOptions)).rejects.toThrow(
      "Failed to verify event capacity",
    );
    expect(createSession).not.toHaveBeenCalled();
  });
});
