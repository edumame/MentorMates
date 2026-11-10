import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiKeysTab } from "./ApiKeysTab";

const toast = jest.fn();
jest.mock("@/lib/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

function mockFetch(handlers: Record<string, { ok: boolean; body: unknown }>) {
  const fn = jest.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url.split("?")[0]}`;
    const h = handlers[key] ?? { ok: true, body: { keys: [] } };
    return { ok: h.ok, json: async () => h.body } as Response;
  });
  (global as { fetch?: unknown }).fetch = fn;
  return fn;
}

beforeEach(() => {
  toast.mockClear();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("ApiKeysTab (ORG-023)", () => {
  it("creates event-scoped keys", async () => {
    const fetchMock = mockFetch({ "POST /api/agent/keys": { ok: true, body: { api_key: "mm_sk_x" } } });
    render(<ApiKeysTab eventId="event-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Generate Key" }));
    await screen.findByText("mm_sk_x");
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({ event_id: "event-1", scope_mode: "event", label: "default" });
  });

  it("shows an error toast when creating fails", async () => {
    mockFetch({ "POST /api/agent/keys": { ok: false, body: { error: "Only organizers can generate organizer agent keys" } } });
    render(<ApiKeysTab eventId="event-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Generate Key" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", description: "Only organizers can generate organizer agent keys" })
      )
    );
  });

  it("shows an error toast when revoking fails and when listing fails", async () => {
    mockFetch({
      "GET /api/agent/keys": { ok: true, body: { keys: [{ id: "k1", event_id: "event-1", key_prefix: "mm_sk_a", label: "ci", scopes: [], last_used_at: null, created_at: null }] } },
      "DELETE /api/agent/keys": { ok: false, body: { error: "Failed to revoke key" } },
    });
    render(<ApiKeysTab eventId="event-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Revoke API key ci" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: "Failed to revoke key" }))
    );

    toast.mockClear();
    mockFetch({ "GET /api/agent/keys": { ok: false, body: { error: "Failed to fetch keys" } } });
    render(<ApiKeysTab eventId="event-2" />);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: "Failed to fetch keys" }))
    );
  });

  it("labels legacy account-wide keys and confirms before revoking them", async () => {
    const fetchMock = mockFetch({
      "GET /api/agent/keys": {
        ok: true,
        body: {
          keys: [
            { id: "k-event", event_id: "event-1", key_prefix: "mm_sk_e", label: "event", scopes: [], last_used_at: null, created_at: null },
            { id: "k-all", event_id: null, key_prefix: "mm_sk_a", label: "legacy", scopes: [], last_used_at: null, created_at: null },
          ],
        },
      },
      "DELETE /api/agent/keys": { ok: true, body: { success: true } },
    });
    const confirm = jest.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<ApiKeysTab eventId="event-1" />);
    expect(await screen.findByText("All your events")).toBeInTheDocument();
    expect(screen.getAllByText("All your events")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Revoke API key legacy" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Revoke API key legacy" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true));

    confirm.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Revoke API key event" }));
    expect(confirm).not.toHaveBeenCalled();
  });
});
