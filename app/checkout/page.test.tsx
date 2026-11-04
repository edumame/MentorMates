import { render, screen, waitFor } from "@testing-library/react";
import Checkout from "./page";
import { fetchClientSecret } from "../actions/stripe";

jest.mock("@stripe/stripe-js", () => ({ loadStripe: jest.fn(() => null) }));

jest.mock("@stripe/react-stripe-js", () => ({
  EmbeddedCheckoutProvider: ({
    options,
    children,
  }: {
    options: { fetchClientSecret: () => Promise<string> };
    children: React.ReactNode;
  }) => {
    options.fetchClientSecret().catch(() => {});
    return <>{children}</>;
  },
  EmbeddedCheckout: () => <div>stripe form</div>,
}));

jest.mock("../actions/stripe", () => ({ fetchClientSecret: jest.fn() }));

jest.mock("next/navigation", () => ({
  useSearchParams: () =>
    new URLSearchParams(
      "eventId=event-1&eventName=Paid&pricingTierId=tier-1&role=mentor",
    ),
}));

describe("Checkout page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes the joining role to the checkout action", async () => {
    (fetchClientSecret as jest.Mock).mockResolvedValue("secret");

    render(<Checkout />);

    await waitFor(() =>
      expect(fetchClientSecret).toHaveBeenCalledWith(
        expect.objectContaining({ role: "mentor" }),
      ),
    );
  });

  it("tells the user they were not charged when checkout is refused", async () => {
    (fetchClientSecret as jest.Mock).mockRejectedValue(new Error("full"));

    render(<Checkout />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You have not been charged",
    );
    expect(screen.queryByText("stripe form")).not.toBeInTheDocument();
  });
});
