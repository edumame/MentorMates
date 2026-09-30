import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BugReportDialog } from "@/components/layout/BugReportDialog";

describe("BugReportDialog", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.restoreAllMocks();
    onClose.mockReset();
  });

  it("disables Send until the description has at least 10 characters", async () => {
    const user = userEvent.setup();
    render(<BugReportDialog open onClose={onClose} />);
    const send = screen.getByRole("button", { name: /send/i });
    expect(send).toBeDisabled();
    await user.type(screen.getByRole("textbox"), "short");
    expect(send).toBeDisabled();
    await user.type(screen.getByRole("textbox"), " but now long enough");
    expect(send).toBeEnabled();
  });

  it("posts the report and shows a thank-you", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "abc" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<BugReportDialog open onClose={onClose} />);
    await user.type(
      screen.getByRole("textbox"),
      "Clicking submit on the project form does nothing."
    );
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getByText(/thanks/i)).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/bug-reports");
    const body = (init as RequestInit).body as FormData;
    expect(body.get("type")).toBe("bug");
    expect(body.get("priority")).toBe("medium");
    expect(body.get("category")).toBe("other");
    expect(String(body.get("description"))).toContain("does nothing");
  });

  it("surfaces the server error message on failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Pick a category." }),
    }) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<BugReportDialog open onClose={onClose} />);
    await user.type(screen.getByRole("textbox"), "A long enough description here.");
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() =>
      expect(screen.getByText("Pick a category.")).toBeInTheDocument()
    );
  });
});
