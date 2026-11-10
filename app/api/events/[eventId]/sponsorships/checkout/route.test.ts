/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { stripe } from "@/lib/stripe/stripe";
import type Stripe from "stripe";

jest.mock("@/app/utils/supabase/server", () => ({ createSupabaseClient: jest.fn() }));
jest.mock("@/lib/stripe/stripe", () => ({
  stripe: { checkout: { sessions: { create: jest.fn() } } },
}));

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const liveEvent = {
  event_id: EVENT_ID,
  event_name: "Real Hackathon",
  slug: "real-hack",
  visibility: "public",
  approval_status: "approved",
  sponsorship_tiers: { tiers: [{ id: "gold", price: 123400 }] },
};

function mockEvents(byColumn: Record<string, unknown>) {
  const eqCalls: unknown[][] = [];
  jest.mocked(createSupabaseClient).mockResolvedValue({
    from: () => {
      let column = "";
      const q = {
        select: () => q,
        eq: (col: string, value: unknown) => {
          eqCalls.push([col, value]);
          column = col;
          return q;
        },
        or: () => {
          throw new Error("or() must not be used with the raw identifier");
        },
        maybeSingle: async () => ({ data: byColumn[column] ?? null, error: null }),
      };
      return q;
    },
  } as never);
  return eqCalls;
}

const params = (eventId: string) => ({ params: Promise.resolve({ eventId }) });
const get = (eventId: string, tier = "gold", headers: Record<string, string> = {}) =>
  GET(new NextRequest(`http://localhost:3000/api/events/${encodeURIComponent(eventId)}/sponsorships/checkout?tier=${tier}`, { headers }), params(eventId));

describe("sponsorship checkout (PUB-019)", () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
    jest.mocked(stripe.checkout.sessions.create).mockReset();
    jest.mocked(stripe.checkout.sessions.create).mockResolvedValue({ url: "https://checkout.stripe.test/s" } as never);
  });
  afterAll(() => {
    process.env.STRIPE_SECRET_KEY = originalKey;
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("404s an attacker-chosen identifier instead of using it as the product name", async () => {
    mockEvents({});
    const res = await get("Official MentorMates Verification Fee");
    expect(res.status).toBe(404);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("404s an unknown slug", async () => {
    mockEvents({});
    expect((await get("no-such-event")).status).toBe(404);
  });

  it.each([
    ["draft", { visibility: "draft" }],
    ["archived", { visibility: "archived" }],
    ["pending review", { approval_status: "submitted" }],
    ["rejected", { approval_status: "rejected" }],
  ])("404s a %s event", async (_label, override) => {
    mockEvents({ slug: { ...liveEvent, ...override } });
    expect((await get("real-hack")).status).toBe(404);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("400s an invalid tier before any lookup", async () => {
    const eqCalls = mockEvents({ slug: liveEvent });
    expect((await get("real-hack", "platinum")).status).toBe(400);
    expect(eqCalls).toHaveLength(0);
  });

  it("returns 503 (not a crash) when Stripe is not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    mockEvents({ slug: liveEvent });
    expect((await get("real-hack")).status).toBe(503);
  });

  it("creates the session from DB data and the app URL, ignoring the Origin header", async () => {
    const eqCalls = mockEvents({ event_id: liveEvent });
    const res = await get(EVENT_ID, "gold", { origin: "https://evil.example" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://checkout.stripe.test/s");
    expect(eqCalls[0]).toEqual(["event_id", EVENT_ID]);
    const args = jest.mocked(stripe.checkout.sessions.create).mock.calls[0][0] as Stripe.Checkout.SessionCreateParams;
    expect(args.line_items?.[0].price_data?.product_data?.name).toBe("Real Hackathon Sponsorship - Gold");
    expect(args.line_items?.[0].price_data?.unit_amount).toBe(123400);
    expect(args.success_url).toBe("https://app.example.test/events/real-hack/sponsorships?success=true");
    expect(args.cancel_url).not.toContain("evil.example");
  });

  it("POST validates the same way", async () => {
    mockEvents({});
    const res = await POST(
      new NextRequest("http://localhost:3000/api/events/x/sponsorships/checkout", {
        method: "POST",
        body: JSON.stringify({ tier: "gold" }),
      }),
      params("Fake Fee")
    );
    expect(res.status).toBe(404);
  });
});
