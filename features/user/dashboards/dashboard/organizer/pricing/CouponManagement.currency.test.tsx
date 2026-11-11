import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const toastMock = jest.fn();
jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { CouponManagement } from "./CouponManagement";

function mockCouponApi() {
  global.fetch = jest.fn(async (_url: string, init?: RequestInit) => ({
    ok: true,
    json: async () => (init?.method === "POST" ? { success: true } : { coupons: [] }),
  })) as unknown as typeof fetch;
}

function postedBodies() {
  return (global.fetch as jest.Mock).mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([url, init]) => {
      expect(url).toBe("/api/stripe/coupon");
      return JSON.parse(init.body);
    });
}

async function openCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Create New Coupon" }));
  await user.type(screen.getByLabelText(/coupon name/i), "Early Bird");
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Create Coupon" }));
}

function currencySelect() {
  return screen.getAllByRole("combobox")[1];
}

async function pickCurrency(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(currencySelect());
  await user.click(await screen.findByRole("option", { name }));
}

describe("CouponManagement fixed-amount currency", () => {
  beforeAll(() => {
    // Radix Select relies on browser APIs that jsdom does not implement.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
    Element.prototype.scrollIntoView = () => undefined;
  });

  beforeEach(() => {
    toastMock.mockClear();
    mockCouponApi();
  });

  it("posts the displayed default currency when none was picked", async () => {
    const user = userEvent.setup();
    render(<CouponManagement eventId="event-1" />);
    await openCreateForm(user);
    await user.type(screen.getByLabelText("Fixed Amount Off"), "10");

    expect(currencySelect()).toHaveTextContent("USD");
    await submit(user);

    await waitFor(() => expect(postedBodies()).toHaveLength(1));
    expect(postedBodies()[0]).toMatchObject({ amount_off: 1000, currency: "usd" });
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" })
    );
  });

  it("posts the default when USD is re-picked, which Radix treats as no change", async () => {
    const user = userEvent.setup();
    render(<CouponManagement eventId="event-1" />);
    await openCreateForm(user);
    await user.type(screen.getByLabelText("Fixed Amount Off"), "10");
    await pickCurrency(user, "USD");
    await submit(user);

    await waitFor(() => expect(postedBodies()).toHaveLength(1));
    expect(postedBodies()[0]).toMatchObject({ amount_off: 1000, currency: "usd" });
  });

  it("keeps a currency the organizer picked", async () => {
    const user = userEvent.setup();
    render(<CouponManagement eventId="event-1" />);
    await openCreateForm(user);
    await user.type(screen.getByLabelText("Fixed Amount Off"), "10");
    await pickCurrency(user, "EUR");
    await submit(user);

    await waitFor(() => expect(postedBodies()).toHaveLength(1));
    expect(postedBodies()[0]).toMatchObject({ amount_off: 1000, currency: "eur" });
  });

  it("applies the default again on the coupon created after the form resets", async () => {
    const user = userEvent.setup();
    render(<CouponManagement eventId="event-1" />);

    for (const expectedPosts of [1, 2]) {
      await openCreateForm(user);
      await user.type(screen.getByLabelText("Fixed Amount Off"), "10");
      await submit(user);
      await waitFor(() => expect(postedBodies()).toHaveLength(expectedPosts));
      await waitFor(() =>
        expect(
          screen.queryByRole("button", { name: "Create Coupon" })
        ).not.toBeInTheDocument()
      );
    }

    expect(postedBodies()[1]).toMatchObject({ amount_off: 1000, currency: "usd" });
  });

  it("does not add a currency to percentage coupons", async () => {
    const user = userEvent.setup();
    render(<CouponManagement eventId="event-1" />);
    await openCreateForm(user);
    await user.type(screen.getByLabelText(/percentage off/i), "25");
    await submit(user);

    await waitFor(() => expect(postedBodies()).toHaveLength(1));
    expect(postedBodies()[0]).toMatchObject({ percent_off: 25 });
    expect(postedBodies()[0]).not.toHaveProperty("currency");
  });
});
