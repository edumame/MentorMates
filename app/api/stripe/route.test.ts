/** @jest-environment node */

import { createSupabaseServiceClient } from "@/app/utils/supabase/server";
import { stripe } from "@/lib/stripe/stripe";
import { isParticipantSeatAvailable } from "@/lib/events/participant-access";
import {
  createSeatStore,
  SEAT_STORE_EVENT_ID,
  type SeatStoreSeed,
} from "@/lib/events/__fixtures__/seat-store";
import { POST } from "./route";

jest.mock("@/lib/stripe/stripe", () => ({
  stripe: { webhooks: { constructEvent: jest.fn() } },
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

describe("POST /api/stripe charge.refunded", () => {
  const useStore = (seed: Partial<SeatStoreSeed> = {}) => {
    const store = createSeatStore({
      participantCapacity: 1,
      paid: true,
      roles: { alice: "participant" },
      requests: { alice: "approved" },
      extraTables: {
        user_event_payments: [
          {
            id: "payment-1",
            event_id: SEAT_STORE_EVENT_ID,
            user_id: "alice",
            payment_status: "paid",
            stripe_payment_intent_id: "pi_1",
          },
        ],
        event_tickets: [{ id: "ticket-1", payment_id: "payment-1" }],
      },
      ...seed,
    });

    (createSupabaseServiceClient as jest.Mock).mockResolvedValue(store.client);

    return store;
  };

  const refund = () =>
    POST(
      new Request("https://example.test/api/stripe", {
        method: "POST",
        headers: { "stripe-signature": "signature" },
        body: "{}",
      }),
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
      type: "charge.refunded",
      data: { object: { payment_intent: "pi_1" } },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("gives the seat back when a paid participant is refunded", async () => {
    const store = useStore();

    const response = await refund();

    expect(response.status).toBe(200);
    expect(store.rows("user_event_payments")[0].payment_status).toBe("refunded");
    expect(store.rows("event_tickets")).toHaveLength(0);
    expect(store.roleOf("alice")).toBeUndefined();
    expect(store.requestStatusOf("alice")).toBe("withdrawn");
    await expect(
      isParticipantSeatAvailable(store.client, {
        eventId: store.eventId,
        userId: "bob",
      }),
    ).resolves.toBe(true);
  });

  it("gives the seat back when the user was refunded before joining", async () => {
    const store = useStore({ roles: {} });

    await refund();

    expect(store.requestStatusOf("alice")).toBe("withdrawn");
  });

  it("fails the webhook so Stripe retries when the seat cannot be released", async () => {
    const store = useStore({ failingTables: ["participant_approval_requests"] });

    await expect(refund()).rejects.toThrow("Stripe processing error");
    expect(store.roleOf("alice")).toBe("participant");
  });
});
