/** @jest-environment node */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { stripe } from "@/lib/stripe/stripe";
import { POST } from "./route";

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

jest.mock("@/lib/stripe/stripe", () => ({
  stripe: {
    prices: { retrieve: jest.fn() },
    coupons: { create: jest.fn(), del: jest.fn() },
  },
}));

const FUTURE_ISO = "2099-12-01T10:00:00.000Z";
const FUTURE_SECONDS = Date.UTC(2099, 11, 1, 10) / 1000;

describe("POST /api/stripe/coupon", () => {
  const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
  const mockCouponCreate = stripe.coupons.create as jest.Mock;
  const mockPriceRetrieve = stripe.prices.retrieve as jest.Mock;
  let insert: jest.Mock;

  const post = (body: Record<string, unknown>) =>
    POST(
      new Request("http://localhost/api/stripe/coupon", {
        method: "POST",
        body: JSON.stringify({
          couponName: "Early Bird",
          eventId: "event-1",
          percent_off: 25,
          duration: "once",
          ...body,
        }),
      })
    );

  beforeEach(() => {
    jest.clearAllMocks();

    insert = jest.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: "coupon-row-1" }, error: null }),
      }),
    }));

    mockCreateSupabaseClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "admin-1" } } }),
      },
      rpc: async () => ({ data: true }),
      from: (table: string) =>
        table === "coupons"
          ? { insert }
          : {
              select: () => ({
                eq: () => ({
                  eq: async () => ({
                    data: [{ stripe_price_id: "price_1" }],
                    error: null,
                  }),
                }),
              }),
            },
    });

    mockPriceRetrieve.mockResolvedValue({ product: "prod_1" });
    mockCouponCreate.mockResolvedValue({ id: "stripe_coupon_1" });
  });

  it("forwards duration_in_months to Stripe and the database for repeating coupons", async () => {
    const response = await post({ duration: "repeating", duration_in_months: 3 });

    expect(response.status).toBe(200);
    expect(mockCouponCreate).toHaveBeenCalledWith(
      expect.objectContaining({ duration: "repeating", duration_in_months: 3 })
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ duration: "repeating", duration_in_months: 3 })
    );
  });

  it.each([
    ["missing", undefined],
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
  ])("rejects repeating coupons with %s duration_in_months", async (_label, months) => {
    const response = await post({
      duration: "repeating",
      duration_in_months: months,
    });

    expect(response.status).toBe(400);
    expect(mockCouponCreate).not.toHaveBeenCalled();
  });

  it("ignores a leftover duration_in_months when the coupon is not repeating", async () => {
    const response = await post({ duration: "once", duration_in_months: 3 });

    expect(response.status).toBe(200);
    expect(mockCouponCreate.mock.calls[0][0].duration_in_months).toBeUndefined();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ duration_in_months: null })
    );
  });

  it("sends redeem_by to Stripe as Unix seconds and stores the same instant", async () => {
    const response = await post({ redeem_by: FUTURE_ISO });

    expect(response.status).toBe(200);
    expect(mockCouponCreate).toHaveBeenCalledWith(
      expect.objectContaining({ redeem_by: FUTURE_SECONDS })
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ redeem_by: FUTURE_ISO })
    );
  });

  it("omits redeem_by when the coupon has no expiry", async () => {
    const response = await post({});

    expect(response.status).toBe(200);
    expect(mockCouponCreate.mock.calls[0][0].redeem_by).toBeUndefined();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ redeem_by: null })
    );
  });

  it.each([
    ["malformed", "not-a-date"],
    ["past", "2000-01-01T00:00:00.000Z"],
  ])("rejects a %s redeem_by before calling Stripe", async (_label, redeemBy) => {
    const response = await post({ redeem_by: redeemBy });

    expect(response.status).toBe(400);
    expect(mockCouponCreate).not.toHaveBeenCalled();
  });
});
