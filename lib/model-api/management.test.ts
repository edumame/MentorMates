/** @jest-environment node */
jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/model-api/auth", () => ({ requireModelAccount: jest.fn() }));
jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

import { GET, POST, DELETE } from "@/app/api/model-api/keys/route";
import { GET as historyGET } from "@/app/api/model-api/requests/route";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireModelAccount } from "./auth";
import { ModelApiError } from "./http";
import { hashApiKey } from "@/lib/agent/crypto";

const id = "11111111-1111-4111-8111-111111111111";
let result: { data: unknown; error: unknown };
const query = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  eq: jest.fn(),
  order: jest.fn(),
  limit: jest.fn(),
  or: jest.fn(),
  single: jest.fn(),
  maybeSingle: jest.fn(),
  then: (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve),
};
function body(value: unknown, method = "POST") {
  return new Request("https://example.com/api/model-api/keys", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  result = { data: [], error: null };
  for (const method of [
    "select",
    "insert",
    "update",
    "eq",
    "order",
    "limit",
    "or",
  ] as const)
    query[method].mockReturnValue(query);
  query.single.mockImplementation(() => Promise.resolve(result));
  query.maybeSingle.mockImplementation(() => Promise.resolve(result));
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnValue(query),
  });
  (requireModelAccount as jest.Mock).mockResolvedValue({ id: "owner" });
});

it("rejects every management route without an account", async () => {
  (requireModelAccount as jest.Mock).mockRejectedValue(
    new ModelApiError(401, "account_required", "Sign in"),
  );
  for (const response of await Promise.all([
    GET(new Request("https://example.com/api/model-api/keys")),
    POST(body({ label: "key" })),
    DELETE(body({ key_id: id }, "DELETE")),
    historyGET(new Request("https://example.com/api/model-api/requests")),
  ])) {
    expect(response.status).toBe(401);
  }
  expect(createSupabaseServiceClient).not.toHaveBeenCalled();
});
it("returns the new key once but stores only its hash under the verified account", async () => {
  result.data = { id, label: "key" };
  const response = await POST(body({ label: "key" }));
  const payload = await response.json();
  expect(response.status).toBe(201);
  expect(payload.api_key).toMatch(/^mm_model_[a-f0-9]{64}$/);
  expect(query.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      user_id: "owner",
      key_hash: hashApiKey(payload.api_key),
    }),
  );
  expect(JSON.stringify(query.insert.mock.calls)).not.toContain(
    payload.api_key,
  );
  expect(query.select).not.toHaveBeenCalledWith(
    expect.stringContaining("key_hash"),
  );
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it.each([
  { label: " " },
  { label: "x", user_id: "someone_else" },
  { label: "x", expires_at: "2000-01-01T00:00:00Z" },
])("rejects invalid key metadata %#", async (value) => {
  expect((await POST(body(value))).status).toBe(400);
  expect(query.insert).not.toHaveBeenCalled();
});
it("maps malformed key JSON to 400", async () => {
  expect(
    (
      await POST(
        new Request("https://example.com", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }),
      )
    ).status,
  ).toBe(400);
});
it("lists only the caller's safe key metadata", async () => {
  expect((await GET(new Request("https://example.com/api/model-api/keys"))).status).toBe(200);
  expect(query.eq).toHaveBeenCalledWith("user_id", "owner");
  expect(query.select).not.toHaveBeenCalledWith(
    expect.stringContaining("key_hash"),
  );
});

it("rejects cross-origin key mutations even when a session is present", async () => {
  const request = new Request("https://example.com/api/model-api/keys", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://another.example" }, body: JSON.stringify({ label: "forged" }) });
  expect((await POST(request)).status).toBe(403);
  expect(query.insert).not.toHaveBeenCalled();
});

it("rejects simple form/text key mutations", async () => {
  expect((await POST(new Request("https://example.com/api/model-api/keys", { method: "POST", body: JSON.stringify({ label: "forged" }) }))).status).toBe(415);
  expect(query.insert).not.toHaveBeenCalled();
});

it("returns a cursor so old active keys remain manageable", async () => {
  result.data = Array.from({ length: 26 }, (_, index) => ({ id, created_at: `2026-09-19T00:00:${String(index).padStart(2, "0")}.000Z` }));
  const response = await GET(new Request("https://example.com/api/model-api/keys"));
  const page = await response.json();
  expect(page.keys).toHaveLength(25);
  expect(page.next_cursor).toBeTruthy();
  result.data = [];
  expect((await GET(new Request(`https://example.com/api/model-api/keys?cursor=${page.next_cursor}`))).status).toBe(200);
  expect(query.or).toHaveBeenCalledWith(expect.stringContaining(`id.lt.${id}`));
});
it("cannot revoke another account's key and does not expose its existence", async () => {
  result.data = null;
  expect((await DELETE(body({ key_id: id }, "DELETE"))).status).toBe(404);
  expect(query.eq).toHaveBeenCalledWith("user_id", "owner");
  expect(query.eq).toHaveBeenCalledWith("id", id);
});
it("scopes request body retrieval to the account", async () => {
  result.data = null;
  expect(
    (
      await historyGET(
        new Request(`https://example.com/api/model-api/requests?id=${id}`),
      )
    ).status,
  ).toBe(404);
  expect(query.eq).toHaveBeenCalledWith("user_id", "owner");
  expect(query.eq).toHaveBeenCalledWith("id", id);
});
it("paginates metadata without loading request and response bodies", async () => {
  result.data = Array.from({ length: 26 }, (_, index) => ({
    id,
    created_at: `2026-09-19T00:00:${String(index).padStart(2, "0")}.000Z`,
  }));
  const response = await historyGET(
    new Request("https://example.com/api/model-api/requests"),
  );
  const page = await response.json();
  expect(page.requests).toHaveLength(25);
  expect(page.next_cursor).toBeTruthy();
  expect(query.select).not.toHaveBeenCalledWith(
    expect.stringContaining("request_body"),
  );
  expect(query.limit).toHaveBeenCalledWith(26);
  result.data = [];
  expect(
    (
      await historyGET(
        new Request(
          `https://example.com/api/model-api/requests?cursor=${page.next_cursor}`,
        ),
      )
    ).status,
  ).toBe(200);
  expect(query.or).toHaveBeenCalledWith(expect.stringContaining(`id.lt.${id}`));
});
it("rejects invalid cursors before they can enter a PostgREST filter", async () => {
  const cursor = Buffer.from(
    JSON.stringify({ id: "x),user_id.neq.owner", created_at: "today" }),
  ).toString("base64url");
  expect(
    (
      await historyGET(
        new Request(
          `https://example.com/api/model-api/requests?cursor=${cursor}`,
        ),
      )
    ).status,
  ).toBe(400);
  expect(query.or).not.toHaveBeenCalled();
});
