import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordTab } from "./PasswordTab";
import type { EventDetails } from "@/lib/types";

const toast = jest.fn();
jest.mock("@/lib/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const eqMock = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { from: () => ({ select: () => ({ eq: (...args: unknown[]) => eqMock(...args) }) }) },
}));

const renderTab = () =>
  render(<PasswordTab eventId="evt" isArchived={false} event={{} as EventDetails} setEvent={jest.fn()} />);

describe("PasswordTab (ORG-013)", () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    toast.mockReset();
    eqMock.mockResolvedValue({ data: [{ role: "judge" }], error: null });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  });
  afterAll(() => { global.fetch = originalFetch; });

  it("shows which roles have a password and offers no organizer password", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByTestId("role-password-status-judge")).toHaveTextContent("Password set"));
    expect(screen.getByTestId("role-password-status-mentor")).toHaveTextContent("No password set");
    expect(screen.queryByLabelText(/organizer password/i)).not.toBeInTheDocument();
  });

  it("removes a configured password", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole("button", { name: "Remove" }));
    expect(global.fetch).toHaveBeenCalledWith("/api/roles/set-password", expect.objectContaining({
      method: "DELETE", body: JSON.stringify({ eventId: "evt", role: "judge" }),
    }));
  });

  it("refuses short passwords before calling the API", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.type(screen.getByLabelText(/judge password/i), "short");
    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    await user.click(saveButtons[1]);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Password too short" }));
  });
});
