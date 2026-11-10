import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CouponManagement } from "./CouponManagement";

const toast = jest.fn();

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

describe("CouponManagement create form", () => {
  const originalFetch = global.fetch;

  const openForm = async () => {
    const user = userEvent.setup();
    render(<CouponManagement eventId="event-1" />);
    await user.click(
      await screen.findByRole("button", { name: "Create New Coupon" })
    );
    await user.type(screen.getByLabelText("Coupon Name *"), "Early Bird");
    return user;
  };

  const submitAndReadBody = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "Create Coupon" }));

    let postCall: unknown[] | undefined;
    await waitFor(() => {
      postCall = (global.fetch as jest.Mock).mock.calls.find(
        ([, init]) => init?.method === "POST"
      );
      expect(postCall).toBeDefined();
    });
    return JSON.parse((postCall![1] as RequestInit).body as string);
  };

  beforeEach(() => {
    toast.mockReset();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ coupons: [], success: true }),
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it.each([
    ["19.99", 1999],
    ["4.35", 435],
    ["1.10", 110],
    ["10.50", 1050],
  ])("sends %s as a whole number of cents", async (typed, cents) => {
    const user = await openForm();

    fireEvent.change(screen.getByLabelText("Fixed Amount Off"), {
      target: { value: typed },
    });

    const body = await submitAndReadBody(user);
    expect(body.amount_off).toBe(cents);
  });

  it("uses the currency the form displays when none was picked", async () => {
    const user = await openForm();

    fireEvent.change(screen.getByLabelText("Fixed Amount Off"), {
      target: { value: "19.99" },
    });

    const body = await submitAndReadBody(user);
    expect(body.currency).toBe("usd");
  });

  it("does not send a currency with a percentage coupon", async () => {
    const user = await openForm();
    const amountInput = screen.getByLabelText("Fixed Amount Off");

    fireEvent.change(amountInput, { target: { value: "5" } });
    fireEvent.change(amountInput, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Percentage Off (%)"), {
      target: { value: "25" },
    });

    const body = await submitAndReadBody(user);
    expect(body.percent_off).toBe(25);
    expect(body.currency).toBeUndefined();
  });

  it("sends the expiration as an absolute instant in the browser's timezone", async () => {
    const user = await openForm();
    const localValue = "2099-12-01T10:00";

    fireEvent.change(screen.getByLabelText("Percentage Off (%)"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByLabelText("Expiration Date (Optional)"), {
      target: { value: localValue },
    });

    const body = await submitAndReadBody(user);
    expect(body.redeem_by).toBe(new Date(localValue).toISOString());
  });

  it("leaves redeem_by out when no expiration is set", async () => {
    const user = await openForm();

    fireEvent.change(screen.getByLabelText("Percentage Off (%)"), {
      target: { value: "25" },
    });

    const body = await submitAndReadBody(user);
    expect(body.redeem_by).toBeUndefined();
  });
});
