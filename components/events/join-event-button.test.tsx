import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JoinEventButton } from "./join-event-button";
import { PricingTierSelector } from "./pricing-tier-selector";
import { RedirectProvider } from "@/features/user/authentication/redirect/RedirectProvider";
import {
  JOIN_EVENT_INTENT_STORAGE_KEY,
  readJoinEventIntent,
} from "@/features/events/join-flow/join-event-intent";
import { toast } from "@/lib/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { ParticipantRequestStatus, type PricingTier } from "@/lib/types";

const push = jest.fn();
const mockTableRows: Record<string, unknown> = {};

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn((table: string) => {
      const result = () => ({ data: mockTableRows[table] ?? null, error: null });
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: () => query,
        maybeSingle: () => Promise.resolve(result()),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) =>
          Promise.resolve(result()).then(resolve),
      };
      return query;
    }),
  },
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (...args: Parameters<typeof push>) => push(...args),
  }),
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

jest.mock("@/lib/hooks/use-toast", () => ({ toast: jest.fn() }));

jest.mock("@/features/intake-forms/components/IntakeFormDialog", () => ({
  IntakeFormDialog: () => null,
}));

const mockGetSession = jest.mocked(supabase.auth.getSession);
const signedIn = {
  data: { session: { user: { id: "user-1" } } },
} as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>;
const signedOut = {
  data: { session: null },
} as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>;

function tier(id: string, name: string): PricingTier {
  return {
    id,
    event_id: "event-1",
    tier_id: id,
    name,
    price: 1000,
  };
}

function renderButton() {
  return render(
    <RedirectProvider>
      <JoinEventButton eventId="event-1" eventName="Hack Night" label="Register" />
    </RedirectProvider>
  );
}

async function openPricingStep() {
  renderButton();
  fireEvent.click(await screen.findByRole("button", { name: "Register" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  await screen.findByRole("button", { name: "Continue to Payment" });
}

function clickContinue() {
  fireEvent.click(screen.getByRole("button", { name: "Continue to Payment" }));
}

describe("JoinEventButton paid registration", () => {
  beforeEach(() => {
    push.mockClear();
    jest.mocked(toast).mockClear();
    localStorage.clear();
    window.history.replaceState({}, "", "/events/hack-night");
    mockGetSession.mockResolvedValue(signedIn);
    for (const table of Object.keys(mockTableRows)) {
      delete mockTableRows[table];
    }
    mockTableRows.events = {
      event_id: "event-1",
      event_name: "Hack Night",
      paid: true,
      slug: "hack-night",
    };
    mockTableRows.pricing_tiers = [
      tier("tier-1", "Regular"),
      tier("tier-2", "VIP"),
    ];
    mockTableRows.role_passwords = [];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hasActiveForm: false, completed: false }),
    }) as unknown as typeof fetch;
  });

  it("sends the chosen tier to checkout after Continue to Payment", async () => {
    await openPricingStep();

    fireEvent.click(screen.getByText("VIP"));
    clickContinue();

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const url = new URL(push.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/checkout");
    expect(url.searchParams.get("pricingTierId")).toBe("tier-2");
    expect(url.searchParams.get("eventId")).toBe("event-1");
    expect(readJoinEventIntent()?.pricingTierId).toBe("tier-2");
    expect(toast).not.toHaveBeenCalled();
  });

  it("uses the default tier when the user does not change the selection", async () => {
    await openPricingStep();

    clickContinue();

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(
      new URL(push.mock.calls[0][0], "http://localhost").searchParams.get(
        "pricingTierId"
      )
    ).toBe("tier-1");
    expect(readJoinEventIntent()?.pricingTierId).toBe("tier-1");
  });

  it("reaches checkout from the approved Pay Now dialog", async () => {
    mockTableRows.participant_approval_requests = {
      id: "request-1",
      status: ParticipantRequestStatus.Approved,
    };
    renderButton();

    fireEvent.click(
      await screen.findByRole("button", { name: "Pay Now - Approved!" })
    );
    fireEvent.click(await screen.findByText("VIP"));
    clickContinue();

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push.mock.calls[0][0]).toContain("/checkout?");
    expect(push.mock.calls[0][0]).toContain("pricingTierId=tier-2");
    expect(toast).not.toHaveBeenCalled();
  });

  it("keeps the chosen tier when the session expired before Continue", async () => {
    await openPricingStep();

    fireEvent.click(screen.getByText("VIP"));
    mockGetSession.mockResolvedValue(signedOut);
    clickContinue();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(localStorage.getItem(JOIN_EVENT_INTENT_STORAGE_KEY)).not.toBeNull();
    expect(readJoinEventIntent()?.pricingTierId).toBe("tier-2");
    expect(toast).not.toHaveBeenCalled();
  });
});

describe("PricingTierSelector", () => {
  it("does not forward the click event to onContinue", () => {
    const onContinue = jest.fn();
    render(
      <PricingTierSelector
        pricingTiers={[tier("tier-1", "Regular")]}
        selectedTierId="tier-1"
        onTierSelect={jest.fn()}
        onContinue={onContinue}
      />
    );

    clickContinue();

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith();
  });
});
