import { render, screen, waitFor } from "@testing-library/react";
import { createClient } from "@/app/utils/supabase/client";
import { PaymentStatusWatcher } from "./payment-status-watcher";

jest.mock("@/app/utils/supabase/client", () => ({
  createClient: jest.fn(),
}));

jest.mock("./post-payment-join", () => ({
  PostPaymentJoin: () => null,
}));

jest.mock("@/components/ui/loading-screen", () => ({
  LoadingScreen: () => null,
}));

describe("PaymentStatusWatcher", () => {
  const mockCreateClient = createClient as jest.Mock;

  const row = {
    id: "payment-1",
    user_id: "user-1",
    event_id: "event-1",
    stripe_session_id: "cs_new",
    payment_status: "paid",
  };

  beforeEach(() => {
    const channel = { on: () => channel, subscribe: () => channel };

    mockCreateClient.mockReturnValue({
      channel: () => channel,
      removeChannel: jest.fn(),
      from: () => {
        const filters: Array<[keyof typeof row, string]> = [];
        const query = {
          select: () => query,
          eq(column: keyof typeof row, value: string) {
            filters.push([column, value]);
            return query;
          },
          single: async () =>
            filters.every(([column, value]) => row[column] === value)
              ? { data: row, error: null }
              : { data: null, error: { message: "no rows" } },
        };
        return query;
      },
    });
  });

  it("finds the payment of a superseded session through the user and event", async () => {
    render(
      <PaymentStatusWatcher
        sessionId="cs_old"
        paymentUserId="user-1"
        paymentEventId="event-1"
      />
    );

    await waitFor(() =>
      expect(screen.getByText("Payment Successful!")).toBeInTheDocument()
    );
  });

  it("looks up by session id when the session carries no metadata", async () => {
    render(<PaymentStatusWatcher sessionId="cs_new" />);

    await waitFor(() =>
      expect(screen.getByText("Payment Successful!")).toBeInTheDocument()
    );
  });
});
