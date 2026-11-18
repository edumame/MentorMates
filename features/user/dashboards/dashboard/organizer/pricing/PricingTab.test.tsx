import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EventDetails, PricingTier } from "@/lib/types";
import { PricingTab } from "./PricingTab";

const mockToast = jest.fn();
let mockTiersInDb: PricingTier[] = [];
const mockTierUpdates: Array<Record<string, unknown>> = [];

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock("./CouponManagement", () => ({ CouponManagement: () => null }));
jest.mock("./PromoCodeManagement", () => ({
  PromoCodeManagement: () => null,
}));

// Minimal in-memory stand-in for the query builder, so a reload after save
// reads back whatever the component actually wrote.
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      let pendingUpdate: Record<string, unknown> | null = null;
      let pendingDelete = false;
      const filters: Array<[string, unknown]> = [];

      const builder = {
        select: () => builder,
        order: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        },
        in: (_column: string, ids: string[]) => {
          if (pendingDelete) {
            mockTiersInDb = mockTiersInDb.filter(
              (tier) => !ids.includes(tier.id)
            );
          }
          return builder;
        },
        update: (payload: Record<string, unknown>) => {
          pendingUpdate = payload;
          return builder;
        },
        delete: () => {
          pendingDelete = true;
          return builder;
        },
        then: (resolve: (result: unknown) => void) => {
          if (table !== "pricing_tiers") {
            return resolve({ data: [], error: null });
          }
          if (pendingUpdate) {
            mockTierUpdates.push(pendingUpdate);
            mockTiersInDb = mockTiersInDb.map((tier) =>
              filters.every(
                ([column, value]) =>
                  (tier as unknown as Record<string, unknown>)[column] === value
              )
                ? ({ ...tier, ...pendingUpdate } as PricingTier)
                : tier
            );
          }
          return resolve({ data: mockTiersInDb, error: null });
        },
      };

      return builder;
    },
  },
}));

const buildTier = (overrides: Partial<PricingTier> = {}): PricingTier => ({
  id: "tier-row-1",
  event_id: "event-1",
  tier_id: "early-bird",
  name: "Early Bird",
  price: 2500,
  currency: "usd",
  description: "",
  stripe_price_id: "price_abc123",
  is_active: true,
  sort_order: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

function Harness({ initialEvent }: { initialEvent: EventDetails }) {
  const [event, setEvent] = useState<EventDetails | null>(initialEvent);
  const [saving, setSaving] = useState(false);

  return (
    <PricingTab
      event={event as EventDetails}
      setEvent={setEvent}
      saving={saving}
      setSaving={setSaving}
    />
  );
}

const renderTab = (eventOverrides: Partial<EventDetails> = {}) =>
  render(
    <Harness
      initialEvent={
        {
          event_id: "event-1",
          paid: true,
          ...eventOverrides,
        } as EventDetails
      }
    />
  );

const paidSwitch = () =>
  screen.getByRole("switch", { name: "This is a paid event" });
const activeSwitch = () => screen.getByRole("switch", { name: "Active" });
const saveButton = () => screen.getByRole("button", { name: /^Save/ });

describe("PricingTab tier deactivation", () => {
  beforeEach(() => {
    mockToast.mockReset();
    mockTierUpdates.length = 0;
    mockTiersInDb = [buildTier()];
  });

  it("keeps tiers visible as inactive after turning paid off and back on", async () => {
    const user = userEvent.setup();
    renderTab();

    await screen.findByDisplayValue("Early Bird");

    await user.click(paidSwitch());
    await waitFor(() => expect(mockTiersInDb[0].is_active).toBe(false));
    await user.click(paidSwitch());

    expect(await screen.findByDisplayValue("Early Bird")).toBeInTheDocument();
    expect(screen.getByDisplayValue("price_abc123")).toBeInTheDocument();
    expect(activeSwitch()).not.toBeChecked();
    expect(
      screen.queryByText("No pricing tiers configured")
    ).not.toBeInTheDocument();
  });

  it("does not make tiers purchasable until the organizer turns them on", async () => {
    const user = userEvent.setup();
    renderTab();

    await screen.findByDisplayValue("Early Bird");
    await user.click(paidSwitch());
    await waitFor(() => expect(mockTiersInDb[0].is_active).toBe(false));
    await user.click(paidSwitch());

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "Success",
        description: expect.stringContaining("Turn on the pricing tiers"),
      })
    );
    expect(mockTiersInDb[0].is_active).toBe(false);
  });

  it("shows tiers already stranded as inactive on a paid event", async () => {
    mockTiersInDb = [buildTier({ is_active: false })];
    renderTab();

    expect(await screen.findByDisplayValue("Early Bird")).toBeInTheDocument();
    expect(activeSwitch()).not.toBeChecked();
  });

  it("reactivates an inactive tier on save", async () => {
    const user = userEvent.setup();
    mockTiersInDb = [buildTier({ is_active: false })];
    renderTab();

    await screen.findByDisplayValue("Early Bird");
    await user.click(activeSwitch());
    await user.click(saveButton());

    await waitFor(() => expect(mockTiersInDb[0].is_active).toBe(true));
    expect(activeSwitch()).toBeChecked();
  });

  it("flags reactivation as unsaved after a paid off and on round trip", async () => {
    const user = userEvent.setup();
    renderTab();

    await screen.findByDisplayValue("Early Bird");
    await user.click(paidSwitch());
    await waitFor(() => expect(mockTiersInDb[0].is_active).toBe(false));
    await user.click(paidSwitch());
    await screen.findByDisplayValue("Early Bird");

    // The deactivation is already persisted, so nothing is pending yet.
    expect(
      screen.queryByText("You have unsaved changes")
    ).not.toBeInTheDocument();

    await user.click(activeSwitch());

    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
  });

  it("can deactivate an active tier without hiding it", async () => {
    const user = userEvent.setup();
    renderTab();

    await screen.findByDisplayValue("Early Bird");
    await user.click(activeSwitch());
    await user.click(saveButton());

    await waitFor(() => expect(mockTiersInDb[0].is_active).toBe(false));
    expect(screen.getByDisplayValue("Early Bird")).toBeInTheDocument();
  });

  it("blocks reactivating a tier without a complete Stripe price", async () => {
    const user = userEvent.setup();
    mockTiersInDb = [buildTier({ is_active: false, stripe_price_id: "price_" })];
    renderTab();

    await screen.findByDisplayValue("Early Bird");
    await user.click(activeSwitch());
    await user.click(saveButton());

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Validation Error" })
    );
    expect(mockTiersInDb[0].is_active).toBe(false);
  });

  it("still lets an inactive tier be deleted", async () => {
    const user = userEvent.setup();
    mockTiersInDb = [buildTier({ is_active: false })];
    renderTab();

    await screen.findByDisplayValue("Early Bird");
    await user.click(
      screen
        .getAllByRole("button")
        .find((button) => button.className.includes("text-red-600"))!
    );

    expect(
      await screen.findByText("No pricing tiers configured")
    ).toBeInTheDocument();

    await user.click(saveButton());
    await waitFor(() => expect(mockTiersInDb).toHaveLength(0));
  });

  it("disables the tier Active control on archived events", async () => {
    mockTiersInDb = [buildTier({ is_active: false })];
    renderTab({ visibility: "archived" } as Partial<EventDetails>);

    await screen.findByDisplayValue("Early Bird");
    expect(activeSwitch()).toBeDisabled();
  });
});

describe("PricingTab sold count", () => {
  beforeEach(() => {
    mockToast.mockReset();
    mockTierUpdates.length = 0;
    mockTiersInDb = [buildTier({ max_quantity: 50, current_quantity: 12 })];
  });

  it("does not send current_quantity when saving an existing tier", async () => {
    const user = userEvent.setup();
    renderTab();

    await screen.findByDisplayValue("Early Bird");
    // A sale lands in the database while the page is open.
    mockTiersInDb = [{ ...mockTiersInDb[0], current_quantity: 13 }];
    await user.click(saveButton());

    await waitFor(() => expect(mockTierUpdates).toHaveLength(1));
    expect(mockTierUpdates[0]).toMatchObject({ tier_id: "early-bird", max_quantity: 50 });
    expect(mockTierUpdates[0]).not.toHaveProperty("current_quantity");
    expect(mockTiersInDb[0].current_quantity).toBe(13);
  });

  it("does not send current_quantity when turning paid off", async () => {
    const user = userEvent.setup();
    renderTab();

    await screen.findByDisplayValue("Early Bird");
    await user.click(paidSwitch());

    await waitFor(() => expect(mockTiersInDb[0].is_active).toBe(false));
    for (const update of mockTierUpdates) {
      expect(update).not.toHaveProperty("current_quantity");
    }
    expect(mockTiersInDb[0].current_quantity).toBe(12);
  });
});
