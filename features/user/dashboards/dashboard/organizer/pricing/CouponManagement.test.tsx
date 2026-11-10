import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CouponManagement } from "./CouponManagement";

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

// Radix Select needs pointer APIs jsdom lacks, so a native select stands in.
jest.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value?: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    children: ReactNode;
  }) => (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

function mockFetch(coupons: unknown[] = []) {
  const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => ({
    ok: true,
    json: async () => (init?.method === "POST" ? { success: true } : { coupons }),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function postedBody(fetchMock: ReturnType<typeof mockFetch>) {
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
  return JSON.parse(post?.[1]?.body as string);
}

function selectCurrency(label: string) {
  const select = screen.getByRole("option", { name: label }).closest("select");
  fireEvent.change(select as HTMLSelectElement, {
    target: {
      value: (screen.getByRole("option", { name: label }) as HTMLOptionElement)
        .value,
    },
  });
}

async function openForm() {
  render(<CouponManagement eventId="event-1" />);
  fireEvent.click(
    await screen.findByRole("button", { name: /create new coupon/i })
  );
  fireEvent.change(screen.getByLabelText(/coupon name/i), {
    target: { value: "Launch" },
  });
}

function enterAmount(value: string) {
  fireEvent.change(screen.getByLabelText(/fixed amount off/i), {
    target: { value },
  });
}

async function submit(fetchMock: ReturnType<typeof mockFetch>) {
  fireEvent.click(screen.getByRole("button", { name: "Create Coupon" }));
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "POST")
    ).toBe(true)
  );
}

describe("CouponManagement fixed amount coupons", () => {
  it.each([
    ["JPY", "jpy"],
    ["KRW", "krw"],
    ["VND", "vnd"],
  ])("sends an unscaled amount for %s", async (label, currency) => {
    const fetchMock = mockFetch();
    await openForm();

    // The currency select stays disabled until an amount is typed.
    enterAmount("500");
    selectCurrency(label);
    await submit(fetchMock);

    expect(postedBody(fetchMock)).toMatchObject({ amount_off: 500, currency });
  });

  it("uses the final currency when the admin switches after typing", async () => {
    const fetchMock = mockFetch();
    await openForm();

    enterAmount("500");
    selectCurrency("JPY");
    selectCurrency("USD");
    await submit(fetchMock);

    expect(postedBody(fetchMock)).toMatchObject({
      amount_off: 50000,
      currency: "usd",
    });
  });

  it("keeps the typed amount visible when the currency changes", async () => {
    mockFetch();
    await openForm();

    enterAmount("500");
    selectCurrency("JPY");

    expect(screen.getByLabelText(/fixed amount off/i)).toHaveValue(500);
  });

  it("sends an integer number of cents for two-decimal currencies", async () => {
    const fetchMock = mockFetch();
    await openForm();

    enterAmount("19.99");
    selectCurrency("USD");
    await submit(fetchMock);

    expect(postedBody(fetchMock)).toMatchObject({
      amount_off: 1999,
      currency: "usd",
    });
  });

  it("only allows whole amounts for zero-decimal currencies", async () => {
    mockFetch();
    await openForm();

    enterAmount("500");
    expect(screen.getByLabelText(/fixed amount off/i)).toHaveAttribute(
      "step",
      "0.01"
    );

    selectCurrency("JPY");
    expect(screen.getByLabelText(/fixed amount off/i)).toHaveAttribute(
      "step",
      "1"
    );
  });

  it("lists the discount Stripe applies", async () => {
    mockFetch([
      {
        id: "c1",
        name: "Yen",
        status: "active",
        duration: "once",
        amount_off: 500,
        currency: "jpy",
      },
      {
        id: "c2",
        name: "Legacy yen",
        status: "active",
        duration: "once",
        amount_off: 50000,
        currency: "jpy",
      },
      {
        id: "c3",
        name: "Dollars",
        status: "active",
        duration: "once",
        amount_off: 1000,
        currency: "usd",
      },
    ]);
    render(<CouponManagement eventId="event-1" />);

    expect(await screen.findByText("¥500 off")).toBeInTheDocument();
    expect(screen.getByText("¥50,000 off")).toBeInTheDocument();
    expect(screen.getByText("$10.00 off")).toBeInTheDocument();
  });
});
