/**
 * @jest-environment ./lib/test-utils/los-angeles-timezone-environment.cjs
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EventDetails, PricingTier } from "@/lib/types";
import { PricingTab } from "./PricingTab";

const toast = jest.fn();
const tierUpdate = jest.fn();
let storedTiers: Partial<PricingTier>[] = [];

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      const rows = table === "pricing_tiers" ? storedTiers : [];
      const query = {
        select: () => query,
        eq: () => query,
        order: () => Promise.resolve({ data: rows, error: null }),
        update: (values: unknown) => {
          if (table === "pricing_tiers") tierUpdate(values);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
      return query;
    },
  },
}));

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

jest.mock("@/lib/hooks/use-event-archive-status", () => ({
  useEventArchiveStatus: () => ({ isArchived: false }),
}));

jest.mock("./CouponManagement", () => ({ CouponManagement: () => null }));
jest.mock("./PromoCodeManagement", () => ({ PromoCodeManagement: () => null }));

const event = { event_id: "event-1", paid: true } as EventDetails;

async function renderAvailableUntilInput(availableUntil?: string) {
  storedTiers = [
    {
      id: "tier-1",
      event_id: "event-1",
      tier_id: "early-bird",
      name: "Early Bird",
      price: 1000,
      stripe_price_id: "price_123",
      available_until: availableUntil,
    },
  ];

  render(
    <PricingTab
      event={event}
      setEvent={jest.fn()}
      saving={false}
      setSaving={jest.fn()}
    />
  );

  return (await screen.findByLabelText(
    "Available Until (Optional)"
  )) as HTMLInputElement;
}

describe("PricingTab Available Until", () => {
  beforeEach(() => {
    tierUpdate.mockReset();
  });

  it("runs in a non-UTC timezone", () => {
    expect(new Date("2026-11-10T20:00:00.000Z").getTimezoneOffset()).toBe(480);
  });

  it("shows a saved cutoff in the organizer's local time", async () => {
    const input = await renderAvailableUntilInput("2026-11-10T20:00:00.000Z");

    expect(input.value).toBe("2026-11-10T12:00");
  });

  it("keeps the entered time in the field and stores its instant", async () => {
    const user = userEvent.setup();
    const input = await renderAvailableUntilInput();

    fireEvent.change(input, { target: { value: "2026-11-10T12:00" } });

    expect(input.value).toBe("2026-11-10T12:00");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(tierUpdate).toHaveBeenCalledTimes(1));
    expect(tierUpdate.mock.calls[0][0].available_until).toBe(
      "2026-11-10T20:00:00.000Z"
    );
  });

  it("does not reapply the offset when another segment is edited", async () => {
    const user = userEvent.setup();
    const input = await renderAvailableUntilInput("2026-11-10T20:00:00.000Z");

    fireEvent.change(input, { target: { value: "2026-11-10T12:30" } });
    expect(input.value).toBe("2026-11-10T12:30");

    fireEvent.change(input, { target: { value: "2026-11-10T12:45" } });
    expect(input.value).toBe("2026-11-10T12:45");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(tierUpdate).toHaveBeenCalledTimes(1));
    expect(tierUpdate.mock.calls[0][0].available_until).toBe(
      "2026-11-10T20:45:00.000Z"
    );
  });

  it("uses the offset in force on the cutoff date, not today's", async () => {
    const input = await renderAvailableUntilInput("2026-07-10T19:00:00.000Z");

    expect(input.value).toBe("2026-07-10T12:00");
  });

  it("clears the cutoff when the field is emptied", async () => {
    const user = userEvent.setup();
    const input = await renderAvailableUntilInput("2026-11-10T20:00:00.000Z");

    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(tierUpdate).toHaveBeenCalledTimes(1));
    expect(tierUpdate.mock.calls[0][0].available_until).toBeUndefined();
  });
});
