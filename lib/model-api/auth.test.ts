/** @jest-environment node */
jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));
jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { generateApiKey, hashApiKey } from "@/lib/agent/crypto";
import { authenticateModelKey, requireModelAccount } from "./auth";

const key = generateApiKey("mm_model_").raw;
const request = (value = `Bearer ${key}`) =>
  new Request("https://example.com/api/v1/systemone", {
    headers: { Authorization: value },
  });
const row = { id: "key", user_id: "user", revoked_at: null, expires_at: null };
const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: row, error: null });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnValue(query),
  });
});

it.each([null, { id: "anon", is_anonymous: true }])(
  "requires an actual account to manage keys",
  async (user) => {
    (createSupabaseClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
      },
    });
    await expect(requireModelAccount()).rejects.toMatchObject({ status: 401 });
  },
);
it("allows an authenticated account", async () => {
  (createSupabaseClient as jest.Mock).mockResolvedValue({
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: { id: "user" } }, error: null }),
    },
  });
  await expect(requireModelAccount()).resolves.toHaveProperty("id", "user");
});
it("looks up a hash, never the raw API key", async () => {
  await expect(authenticateModelKey(request())).resolves.toEqual({
    userId: "user",
    keyId: "key",
    secret: key,
  });
  expect(query.eq).toHaveBeenCalledWith("key_hash", hashApiKey(key));
});
it.each([
  "",
  "Bearer mm_sk_" + "a".repeat(64),
  "Bearer short",
  "Basic anything",
])("rejects invalid or event-agent keys before lookup: %s", async (value) => {
  await expect(authenticateModelKey(request(value))).rejects.toMatchObject({
    status: 401,
  });
  expect(query.eq).not.toHaveBeenCalled();
});
it.each([
  null,
  { ...row, revoked_at: new Date().toISOString() },
  { ...row, expires_at: new Date(Date.now() - 1).toISOString() },
])("rejects missing, revoked, and expired keys %#", async (data) => {
  query.maybeSingle.mockResolvedValue({ data, error: null });
  await expect(authenticateModelKey(request())).rejects.toMatchObject({
    status: 401,
  });
});
it("distinguishes database failure from an invalid credential", async () => {
  query.maybeSingle.mockResolvedValue({
    data: null,
    error: { message: "down" },
  });
  await expect(authenticateModelKey(request())).rejects.toMatchObject({
    status: 503,
  });
});
