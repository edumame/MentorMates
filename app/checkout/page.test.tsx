import { render, screen, waitFor } from "@testing-library/react";
import Checkout from "./page";

const searchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({ useSearchParams: () => searchParams }));
jest.mock("next/link", () => ({ __esModule: true, default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
const loadStripe = jest.fn();
jest.mock("@stripe/stripe-js/pure", () => ({ loadStripe: (...args: unknown[]) => loadStripe(...args) }));
jest.mock("@stripe/react-stripe-js", () => ({
  EmbeddedCheckoutProvider: ({ options, children }: { options: { clientSecret: string }; children: React.ReactNode }) => (
    <div data-testid="provider" data-secret={options.clientSecret}>{children}</div>
  ),
  EmbeddedCheckout: () => <div>embedded checkout</div>,
}));
const fetchClientSecret = jest.fn();
jest.mock("../actions/stripe", () => ({ fetchClientSecret: (...args: unknown[]) => fetchClientSecret(...args) }));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { event_name: "Real Event" } }) }) }),
    }),
  },
}));

function setParams(params: Record<string, string>) {
  for (const key of Array.from(searchParams.keys())) searchParams.delete(key);
  for (const [k, v] of Object.entries(params)) searchParams.set(k, v);
}

// Note: the page caches a successfully loaded Stripe instance at module scope
// (a failed load is not cached), so tests below are ordered accordingly.
async function renderPage() {
  return render(<Checkout />);
}

const ORIGINAL_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

describe("/checkout (PUB-012)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_placeholder";
    loadStripe.mockReset();
    fetchClientSecret.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = ORIGINAL_KEY;
  });

  it("explains there is no event instead of rendering a blank page", async () => {
    setParams({});
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("No event selected");
    expect(screen.getByRole("link", { name: "Browse events" })).toHaveAttribute("href", "/events");
    expect(fetchClientSecret).not.toHaveBeenCalled();
  });

  it("shows an unavailable state when no publishable key is configured", async () => {
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    setParams({ eventId: "evt-1", eventSlug: "demo" });
    await renderPage();
    expect(await screen.findByText("Payments are temporarily unavailable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to event" })).toHaveAttribute("href", "/events/demo/overview");
    expect(loadStripe).not.toHaveBeenCalled();
  });

  it("shows an unavailable state when Stripe.js fails to load", async () => {
    loadStripe.mockRejectedValue(new Error("Failed to load Stripe.js"));
    setParams({ eventId: "evt-1" });
    await renderPage();
    expect(await screen.findByText("Payments are temporarily unavailable")).toBeInTheDocument();
    expect(fetchClientSecret).not.toHaveBeenCalled();
  });

  it("shows an error state when the checkout session cannot be created", async () => {
    loadStripe.mockResolvedValue({});
    fetchClientSecret.mockRejectedValue(new Error("Selected pricing tier is sold out."));
    setParams({ eventId: "evt-1", pricingTierId: "tier-1" });
    await renderPage();
    expect(await screen.findByText("We couldn't start checkout")).toBeInTheDocument();
  });

  it("renders embedded checkout with the real event name, ignoring the eventName query param", async () => {
    loadStripe.mockResolvedValue({});
    fetchClientSecret.mockResolvedValue("cs_secret");
    setParams({ eventId: "evt-1", eventSlug: "demo", pricingTierId: "tier-1", eventName: "Official Verification Fee" });
    await renderPage();
    await waitFor(() => expect(screen.getByTestId("provider")).toHaveAttribute("data-secret", "cs_secret"));
    expect(fetchClientSecret).toHaveBeenCalledWith({ eventId: "evt-1", eventSlug: "demo", pricingTierId: "tier-1" });
    expect(await screen.findByText("Complete Registration for Real Event")).toBeInTheDocument();
    expect(screen.queryByText(/Official Verification Fee/)).not.toBeInTheDocument();
  });
});
