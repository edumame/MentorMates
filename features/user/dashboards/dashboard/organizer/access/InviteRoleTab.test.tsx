import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InviteRoleTab } from "./InviteRoleTab";

const toast = jest.fn();

jest.mock("@/lib/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

describe("InviteRoleTab", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    toast.mockReset();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("submits judge invites to the judge invite endpoint", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, userExists: false }),
    });

    render(
      <InviteRoleTab
        eventId="event-123"
        isArchived={false}
        title="Invite Judges"
        placeholder="Enter judge email address"
        description="Invite judges"
        endpoint="/api/events/invite-judge"
        ariaLabel="Judge email address"
        loadingLabel="Inviting..."
        successTitle="Judge Invited"
        successDescription={(email) => `Sent to ${email}`}
      />
    );

    await user.type(
      screen.getByRole("textbox", { name: "Judge email address" }),
      "Judge@Email.com"
    );
    await user.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/events/invite-judge",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            eventId: "event-123",
            email: "judge@email.com",
          }),
        })
      );
    });

    expect(toast).toHaveBeenCalledWith({
      title: "Judge Invited",
      description: "Sent to judge@email.com",
    });
  });
});
