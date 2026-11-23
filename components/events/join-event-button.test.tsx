import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinEventButton } from "./join-event-button";

const mockPush = jest.fn();
let mockTables: Record<string, { data: unknown; count?: number }> = {};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/features/user/authentication/redirect/RedirectProvider", () => ({
  useRedirect: () => ({ setReturnUrl: jest.fn() }),
}));

jest.mock("@/features/intake-forms/components/IntakeFormDialog", () => ({
  IntakeFormDialog: () => null,
}));

jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));

jest.mock("./pricing-tier-selector", () => ({
  PricingTierSelector: ({
    onTierSelect,
    onContinue,
  }: {
    onTierSelect: (id: string) => void;
    onContinue: () => void;
  }) => (
    <>
      <button onClick={() => onTierSelect("tier-1")}>Pick tier</button>
      <button onClick={() => onContinue()}>Continue</button>
    </>
  ),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { user: { id: "bob" } } },
      })),
    },
    rpc: jest.fn(async () => ({ data: [], error: null })),
    from: jest.fn((table: string) => {
      const result = { error: null, ...mockTables[table] };
      const builder: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown) => resolve(result),
        maybeSingle: jest.fn(async () => result),
      };
      for (const method of ["select", "eq", "in", "order"]) {
        builder[method] = jest.fn(() => builder);
      }
      return builder;
    }),
  },
}));

const tier = {
  id: "tier-1",
  event_id: "event-1",
  name: "General",
  price: 1000,
  is_active: true,
  sort_order: 0,
  available_until: null,
  max_quantity: null,
  current_quantity: 0,
  bundle_size: 1,
};

function mockApprovedUnpaidUser(participantCount: number) {
  mockTables = {
    events: {
      data: {
        event_id: "event-1",
        event_name: "Paid Event",
        slug: "paid-event",
        paid: true,
        participant_capacity: 1,
        require_participant_approval: true,
      },
    },
    pricing_tiers: { data: [tier] },
    role_passwords: { data: [] },
    user_event_roles: { data: null, count: participantCount },
    participant_approval_requests: {
      data: { id: "request-1", status: "approved", rejection_reason: null },
    },
    event_tickets: { data: null },
  };
}

describe("JoinEventButton for an approved user who has not paid", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("does not offer Pay Now when the event is full", async () => {
    mockApprovedUnpaidUser(1);

    render(<JoinEventButton eventId="event-1" eventName="Paid Event" />);

    expect(
      await screen.findByRole("button", { name: "Event Full" }),
    ).toBeDisabled();
    expect(screen.queryByText("Pay Now - Approved!")).not.toBeInTheDocument();
  });

  it("offers Pay Now and goes to checkout while a seat is free", async () => {
    mockApprovedUnpaidUser(0);
    const user = userEvent.setup();

    render(<JoinEventButton eventId="event-1" eventName="Paid Event" />);

    await user.click(
      await screen.findByRole("button", { name: "Pay Now - Approved!" }),
    );
    await user.click(await screen.findByRole("button", { name: "Pick tier" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(mockPush.mock.calls[0][0]).toMatch(/^\/checkout\?/);
    expect(mockPush.mock.calls[0][0]).toContain("pricingTierId=tier-1");
  });
});
