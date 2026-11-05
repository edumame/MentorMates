/** @jest-environment node */

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { sendHtmlEmail } from "@/lib/email/send-html-email";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { POST } from "./route";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock("@/lib/email/send-html-email", () => ({
  sendHtmlEmail: jest.fn(),
}));

const mockSend = sendHtmlEmail as jest.Mock;

describe("POST /api/tickets/[ticketId]/send-claim-email", () => {
  const ticket = {
    id: "ticket-1",
    event_id: "event-1",
    purchased_by_user_id: "user-1",
    assigned_to_email: "friend@email.com",
  };

  const post = (requestBody?: unknown) =>
    POST(
      new Request("http://localhost/api/tickets/ticket-1/send-claim-email", {
        method: "POST",
        body: requestBody ? JSON.stringify(requestBody) : undefined,
      }),
      { params: Promise.resolve({ ticketId: "ticket-1" }) }
    );

  const signIn = (
    user: Record<string, unknown> | null = {
      id: "user-1",
      email: "buyer@email.com",
      user_metadata: { display_name: "<b>Casey</b>" },
    }
  ) =>
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    });

  const withTicket = (row: typeof ticket | null) =>
    (createSupabaseServiceClient as jest.Mock).mockReturnValue({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: jest.fn().mockResolvedValue({
              data:
                table === "events"
                  ? { event_name: "<script>Hack</script>" }
                  : row,
            }),
          }),
        }),
      }),
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue(true);
    signIn();
    withTicket(ticket);
  });

  it("rejects anonymous callers", async () => {
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });

    expect((await post()).status).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("gives the same response for a missing ticket and someone else's", async () => {
    withTicket({ ...ticket, purchased_by_user_id: "someone-else" });
    const notOwner = await post();

    withTicket(null);
    const missing = await post();

    expect(notOwner.status).toBe(404);
    expect(missing.status).toBe(404);
    await expect(notOwner.json()).resolves.toEqual(await missing.json());
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects a ticket with no assignee", async () => {
    withTicket({ ...ticket, assigned_to_email: "" });

    expect((await post()).status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends only to the stored assignee, ignoring the request body", async () => {
    const response = await post({
      to: "victim@email.com",
      html: "<p>phishing</p>",
    });

    expect(response.status).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const message = mockSend.mock.calls[0][0];
    expect(message.to).toBe("friend@email.com");
    expect(message.html).not.toContain("phishing");
  });

  it("escapes the sender and event names in the email", async () => {
    await post();

    const { html } = mockSend.mock.calls[0][0];
    expect(html).toContain("&lt;b&gt;Casey&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;Hack&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("reports a failed send", async () => {
    mockSend.mockResolvedValue(false);

    expect((await post()).status).toBe(500);
  });
});
