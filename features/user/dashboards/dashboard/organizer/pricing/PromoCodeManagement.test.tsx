import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PromoCodeManagement } from "./PromoCodeManagement";
import type { Coupon } from "@/lib/types";

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

// Radix Select needs pointer APIs jsdom lacks, so a native select stands in.
jest.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <select>{children}</select>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

function makeCoupon(overrides: Partial<Coupon>): Coupon {
  return {
    id: "coupon-1",
    event_id: "event-1",
    stripe_coupon_id: "stripe-1",
    name: "Launch",
    duration: "once",
    ...overrides,
  } as Coupon;
}

describe("PromoCodeManagement coupon options", () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ promoCodes: [] }),
    })) as unknown as typeof fetch;
  });

  it("shows fixed discounts in the coupon's own currency", async () => {
    render(
      <PromoCodeManagement
        eventId="event-1"
        coupons={[
          makeCoupon({ id: "yen", name: "Yen", amount_off: 500, currency: "jpy" }),
          makeCoupon({ id: "usd", name: "Usd", amount_off: 1000, currency: "usd" }),
        ]}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: /promo code/i }));

    expect(
      screen.getByRole("option", { name: "Yen - ¥500 off" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Usd - $10.00 off" })
    ).toBeInTheDocument();
  });
});
