import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EventTicket } from "./event-ticket";
import { supabase } from "@/lib/supabase";

const mockToast = jest.fn();

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

const RECIPIENT = "friend@example.com";
const MY_TICKETS_URL = "/api/events/event-1/my-tickets";
const EMAIL_URL = "/api/email_notification";

const baseTicket = {
  id: "ticket-00000001",
  assigned_to_user_id: null,
  assigned_to_email: null,
  ticket_status: "unassigned",
  assigned_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

const assignedTicket = {
  ...baseTicket,
  assigned_to_email: RECIPIENT,
  ticket_status: "assigned",
  assigned_at: "2026-01-02T00:00:00.000Z",
};

type FakeResponse = { ok: boolean; json: () => Promise<unknown> };

const jsonResponse = (body: unknown, ok = true): FakeResponse => ({
  ok,
  json: async () => body,
});

const ticketsResponse = (...tickets: unknown[]) => jsonResponse({ tickets });

function mockFetch({
  myTickets,
  email,
}: {
  myTickets: Array<() => FakeResponse>;
  email: () => FakeResponse;
}) {
  const queue = [...myTickets];
  const fetchMock = jest.fn(async (url: string) => {
    if (url === EMAIL_URL) return email();
    if (url === MY_TICKETS_URL) {
      const next = queue.length > 1 ? queue.shift() : queue[0];
      return next!();
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const callsTo = (fetchMock: jest.Mock, url: string) =>
  fetchMock.mock.calls.filter(([calledUrl]) => calledUrl === url);

let mockTicketUpdate: jest.Mock;

function mockSupabase(updateError: unknown = null) {
  mockTicketUpdate = jest.fn(() => ({
    eq: jest.fn().mockResolvedValue({ error: updateError }),
  }));

  jest.mocked(supabase.auth.getSession).mockResolvedValue({
    data: {
      session: { user: { email: "buyer@example.com", user_metadata: {} } },
    },
  } as never);

  jest.mocked(supabase.from).mockImplementation(((table: string) => {
    if (table === "event_tickets") return { update: mockTicketUpdate };
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { event_name: "Hack Night" } }),
        }),
      }),
    };
  }) as never);
}

async function sendInvitation() {
  fireEvent.change(await screen.findByLabelText("Assign to Email"), {
    target: { value: RECIPIENT },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send Invitation" }));
}

const toastDescriptions = () =>
  mockToast.mock.calls.map(([options]) => options.description as string);

describe("EventTicket", () => {
  beforeAll(() => {
    // jsdom has no crypto.randomUUID; the email request id needs one.
    if (!globalThis.crypto?.randomUUID) {
      let n = 0;
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: {
          ...globalThis.crypto,
          randomUUID: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
        },
      });
    }
  });

  beforeEach(() => {
    mockToast.mockClear();
    mockSupabase();
  });

  it("confirms the assignment when the invitation email is sent", async () => {
    const fetchMock = mockFetch({
      myTickets: [
        () => ticketsResponse(baseTicket),
        () => ticketsResponse(assignedTicket),
      ],
      email: () => jsonResponse({ message: "ok" }),
    });

    render(<EventTicket eventId="event-1" />);
    await sendInvitation();

    expect(await screen.findByText(/Assigned Tickets \(1\)/)).toBeInTheDocument();
    await waitFor(() =>
      expect(toastDescriptions()).toEqual([
        `Ticket assigned to ${RECIPIENT}. An invitation email has been sent.`,
      ])
    );
    expect(callsTo(fetchMock, EMAIL_URL)).toHaveLength(1);
  });

  it("says the ticket was assigned but the email failed, and refreshes the list", async () => {
    const fetchMock = mockFetch({
      myTickets: [
        () => ticketsResponse(baseTicket),
        () => ticketsResponse(assignedTicket),
      ],
      email: () => jsonResponse({ error: "Failed to send email" }, false),
    });

    render(<EventTicket eventId="event-1" />);
    await sendInvitation();

    expect(await screen.findByText(/Assigned Tickets \(1\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Available Tickets/)).not.toBeInTheDocument();
    expect(callsTo(fetchMock, MY_TICKETS_URL)).toHaveLength(2);

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(toastDescriptions()[0]).toContain(`assigned to ${RECIPIENT}`);
    expect(toastDescriptions()[0]).toContain("email could not be sent");
    expect(toastDescriptions()[0]).not.toContain("Failed to assign");
  });

  it("treats a network error while emailing as an email failure", async () => {
    mockFetch({
      myTickets: [
        () => ticketsResponse(baseTicket),
        () => ticketsResponse(assignedTicket),
      ],
      email: () => {
        throw new Error("network down");
      },
    });

    render(<EventTicket eventId="event-1" />);
    await sendInvitation();

    expect(
      await screen.findByRole("button", { name: "Resend Invitation" })
    ).toBeInTheDocument();
    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(toastDescriptions()[0]).toContain("email could not be sent");
  });

  it("still shows the ticket as assigned when the refresh fails after an email failure", async () => {
    mockFetch({
      myTickets: [
        () => ticketsResponse(baseTicket),
        () => jsonResponse({ error: "Failed to fetch tickets" }, false),
      ],
      email: () => jsonResponse({ error: "Failed to send email" }, false),
    });

    render(<EventTicket eventId="event-1" />);
    await sendInvitation();

    expect(await screen.findByText(/Assigned Tickets \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(RECIPIENT)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resend Invitation" })
    ).toBeInTheDocument();
    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(toastDescriptions()[0]).toContain("email could not be sent");
  });

  it("does not report a failure when only the refresh fails after a sent email", async () => {
    mockFetch({
      myTickets: [
        () => ticketsResponse(baseTicket),
        () => jsonResponse({ error: "Failed to fetch tickets" }, false),
      ],
      email: () => jsonResponse({ message: "ok" }),
    });

    render(<EventTicket eventId="event-1" />);
    await sendInvitation();

    expect(await screen.findByText(/Assigned Tickets \(1\)/)).toBeInTheDocument();
    await waitFor(() =>
      expect(toastDescriptions()).toEqual([
        `Ticket assigned to ${RECIPIENT}. An invitation email has been sent.`,
      ])
    );
  });

  it("reports an assignment failure and sends nothing when the save fails", async () => {
    mockSupabase({ message: "denied" });
    const fetchMock = mockFetch({
      myTickets: [() => ticketsResponse(baseTicket)],
      email: () => jsonResponse({ message: "ok" }),
    });

    render(<EventTicket eventId="event-1" />);
    await sendInvitation();

    await waitFor(() =>
      expect(toastDescriptions()).toEqual([
        "Failed to assign ticket. Please try again.",
      ])
    );
    expect(callsTo(fetchMock, EMAIL_URL)).toHaveLength(0);
    expect(screen.getByText(/Available Tickets \(1\)/)).toBeInTheDocument();
    expect(screen.getByLabelText("Assign to Email")).toHaveValue(RECIPIENT);
  });

  it("resends the invitation to the assigned email after a reload", async () => {
    const fetchMock = mockFetch({
      myTickets: [() => ticketsResponse(assignedTicket)],
      email: () => jsonResponse({ message: "ok" }),
    });

    render(<EventTicket eventId="event-1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Resend Invitation" })
    );

    await waitFor(() =>
      expect(toastDescriptions()).toEqual([`Invitation resent to ${RECIPIENT}.`])
    );
    const [[, init]] = callsTo(fetchMock, EMAIL_URL);
    const body = JSON.parse(init.body);
    expect(body.to).toBe(RECIPIENT);
    expect(body.ticketId).toBe(assignedTicket.id);
    expect(body.requestId).toEqual(expect.any(String));
    // The server rebuilds the claim email from ticketId; the html is not trusted.
    expect(mockTicketUpdate).not.toHaveBeenCalled();
  });

  it("keeps the resend control available when resending fails", async () => {
    mockFetch({
      myTickets: [() => ticketsResponse(assignedTicket)],
      email: () => jsonResponse({ error: "Failed to send email" }, false),
    });

    render(<EventTicket eventId="event-1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Resend Invitation" })
    );

    await waitFor(() =>
      expect(toastDescriptions()).toEqual([
        `The invitation email to ${RECIPIENT} could not be sent. Please try again.`,
      ])
    );
    expect(
      await screen.findByRole("button", { name: "Resend Invitation" })
    ).toBeEnabled();
  });

  it.each([
    ["claimed", { ...assignedTicket, assigned_to_user_id: "user-2" }],
    ["used", { ...assignedTicket, ticket_status: "used" }],
  ])("offers no resend for a %s ticket", async (_label, ticket) => {
    mockFetch({
      myTickets: [() => ticketsResponse(ticket)],
      email: () => jsonResponse({ message: "ok" }),
    });

    render(<EventTicket eventId="event-1" />);

    expect(await screen.findByText(/Assigned Tickets \(1\)/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Resend Invitation" })
    ).not.toBeInTheDocument();
  });
});
