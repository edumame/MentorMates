import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeveloperConsole from "./developer-console";

const key = {
  id: "key-1",
  user_id: "owner",
  label: "My app",
  key_prefix: "mm_model_12345678",
  created_at: "2026-09-19T00:00:00Z",
  expires_at: null,
  revoked_at: null,
  last_used_at: null,
};
const secret = "mm_model_" + "a".repeat(64);
const originalFetch = global.fetch;
function response(body: unknown, ok = true) {
  return { ok, json: async () => body };
}
beforeEach(() => {
  global.fetch = jest
    .fn()
    .mockImplementation((path) =>
      Promise.resolve(
        response(
          path === "/api/model-api/keys"
            ? { keys: [] }
            : { requests: [], next_cursor: null },
        ),
      ),
    );
});
afterAll(() => {
  global.fetch = originalFetch;
});
async function mount() {
  const user = userEvent.setup();
  render(<DeveloperConsole minuteLimit={60} dayLimit={1000} />);
  await screen.findByText("Create your first key to start using Jev.");
  return user;
}

it("shows a key only after creation, supports copying, and hides it after acknowledgment", async () => {
  const user = await mount();
  const writeText = jest
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue();
  (fetch as jest.Mock).mockResolvedValueOnce(
    response({ api_key: secret, key }),
  );
  await user.type(screen.getByLabelText("Key name"), "My app");
  await user.click(screen.getByRole("button", { name: "Create key" }));
  expect(await screen.findByTestId("new-api-key")).toHaveTextContent(secret);
  expect(screen.getByRole("button", { name: "Create key" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Copy key" }));
  expect(writeText).toHaveBeenCalledWith(secret);
  await user.click(screen.getByRole("button", { name: "I saved my key" }));
  expect(screen.queryByTestId("new-api-key")).not.toBeInTheDocument();
  expect(screen.getByText("mm_model_12345678…")).toBeInTheDocument();
});
it("displays key-creation failures without displaying a secret", async () => {
  const user = await mount();
  (fetch as jest.Mock).mockResolvedValueOnce(
    response({ error: { message: "Storage unavailable" } }, false),
  );
  await user.type(screen.getByLabelText("Key name"), "My app");
  await user.click(screen.getByRole("button", { name: "Create key" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Storage unavailable",
  );
  expect(screen.queryByTestId("new-api-key")).not.toBeInTheDocument();
});
it("revokes access and clears any displayed secret for that key", async () => {
  const user = await mount();
  (fetch as jest.Mock).mockResolvedValueOnce(
    response({ api_key: secret, key }),
  );
  await user.type(screen.getByLabelText("Key name"), "My app");
  await user.click(screen.getByRole("button", { name: "Create key" }));
  await screen.findByTestId("new-api-key");
  (fetch as jest.Mock).mockResolvedValueOnce(response({ success: true }));
  await user.click(screen.getByRole("button", { name: "Revoke My app" }));
  await screen.findByText("Revoked");
  expect(screen.queryByTestId("new-api-key")).not.toBeInTheDocument();
  expect(fetch).toHaveBeenLastCalledWith(
    "/api/model-api/keys",
    expect.objectContaining({
      method: "DELETE",
      body: JSON.stringify({ key_id: "key-1" }),
    }),
  );
});
it("loads saved bodies on demand and paginates history", async () => {
  const user = await mount();
  const record = {
    id: "request-1",
    requested_model: "jev-latest",
    resolved_model: null,
    created_at: "2026-09-19T00:00:00Z",
    state: "pending",
    duration_ms: null,
    http_status: null,
    input_tokens: null,
    output_tokens: null,
  };
  (fetch as jest.Mock).mockImplementation((path) =>
    Promise.resolve(
      response(
        path === "/api/model-api/keys"
          ? { keys: [] }
          : { requests: [record], next_cursor: "next" },
      ),
    ),
  );
  await user.click(screen.getByRole("button", { name: "Refresh" }));
  await screen.findByText("Awaiting completion");
  (fetch as jest.Mock).mockResolvedValueOnce(
    response({
      request: {
        ...record,
        request_body: { state: "stored input" },
        response_body: null,
      },
    }),
  );
  await user.click(
    screen.getByRole("button", { name: "View request request-1" }),
  );
  expect(
    await screen.findByRole("region", { name: "Request details" }),
  ).toHaveTextContent("stored input");
  (fetch as jest.Mock).mockResolvedValueOnce(
    response({ requests: [{ ...record, id: "request-2" }], next_cursor: null }),
  );
  await user.click(screen.getByRole("button", { name: "Load older requests" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Load older requests" }),
    ).not.toBeInTheDocument(),
  );
  expect(
    screen.getByRole("button", { name: "View request request-2" }),
  ).toBeInTheDocument();
});
