import { fireEvent, render, screen } from "@testing-library/react";
import { PricingTierSelector } from "./pricing-tier-selector";
import type { PricingTier } from "@/lib/types";

jest.mock("@mui/icons-material", () => ({ Check: () => null, AccessTime: () => null, Inventory: () => null }));

const tier: PricingTier = { id: "tier-uuid", event_id: "event-1", tier_id: "regular", name: "Regular", price: 25 };

// PUB-006: the continue handler must not receive the click event as its
// first argument (callers treat it as a pricing tier id override).
it("calls onContinue with no arguments when Continue to Payment is clicked", () => {
  const onContinue = jest.fn();
  render(
    <PricingTierSelector pricingTiers={[tier]} selectedTierId="regular" onTierSelect={jest.fn()} onContinue={onContinue} />
  );
  fireEvent.click(screen.getByRole("button", { name: /Continue to Payment/ }));
  expect(onContinue).toHaveBeenCalledTimes(1);
  expect(onContinue.mock.calls[0]).toEqual([]);
});

it("keeps Continue disabled until a tier is selected", () => {
  const onContinue = jest.fn();
  render(<PricingTierSelector pricingTiers={[tier]} onTierSelect={jest.fn()} onContinue={onContinue} />);
  const button = screen.getByRole("button", { name: /Continue to Payment/ });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(onContinue).not.toHaveBeenCalled();
});
