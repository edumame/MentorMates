/**
 * @jest-environment node
 */

import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  DEVICE_AUTH_NOT_CONFIGURED_MESSAGE,
  MIN_POLL_INTERVAL_SECONDS,
  encryptApiKey,
} from "@/lib/agent/device-auth";
import { FakeSupabase } from "../_test/fake-supabase";
import { POST as createCode } from "../route";
import { POST as approve } from "../approve/route";
import { POST } from "./route";

jest.mock("@/app/utils/supabase/server", () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const mockServiceClient = createSupabaseServiceClient as jest.Mock;

const TEST_KEY = "c".repeat(64);
const DEVICE_CODE = "d".repeat(64);
const DEVICE_CODE_HASH = createHash("sha256").update(DEVICE_CODE).digest("hex");
const RAW_KEY = "mm_sk_" + "e".repeat(64);

function seedCode(db: FakeSupabase, overrides: Record<string, unknown> = {}) {
  const row = {
    id: "code-1",
    device_code_hash: DEVICE_CODE_HASH,
    user_code: "ABCD2345",
    user_id: null,
    access_mode: "participant",
    status: "pending",
    api_key_id: null,
    api_key_raw_encrypted: null,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    last_polled_at: null,
    ...overrides,
  };
  db.tables.device_auth_codes.push(row);
  return row;
}

function seedApproved(db: FakeSupabase, overrides: Record<string, unknown> = {}) {
  db.tables.agent_api_keys.push({ id: "key-1", user_id: "user-1", key_hash: "h" });
  return seedCode(db, {
    status: "approved",
    user_id: "user-1",
    api_key_id: "key-1",
    api_key_raw_encrypted: encryptApiKey(RAW_KEY),
    ...overrides,
  });
}

function tokenRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/device/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const poll = (code = DEVICE_CODE) => POST(tokenRequest({ device_code: code }));

describe("POST /api/auth/device/token", () => {
  const originalEnv = process.env;
  let db: FakeSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    process.env = { ...originalEnv, DEVICE_AUTH_ENCRYPTION_KEY: TEST_KEY };
    db = new FakeSupabase();
    mockServiceClient.mockReturnValue(db);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it.each([
    ["missing device_code", {}],
    ["non-string device_code", { device_code: 42 }],
    ["oversized device_code", { device_code: "x".repeat(1000) }],
    ["invalid JSON", "{oops"],
  ])("returns invalid_request for %s", async (_label, body) => {
    const response = await POST(tokenRequest(body));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_request");
  });

  it("returns invalid_grant for an unknown device code", async () => {
    const response = await poll();
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_grant");
  });

  it("returns authorization_pending and records the poll time", async () => {
    seedCode(db);
    const response = await poll();
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("authorization_pending");
    expect(db.tables.device_auth_codes[0].last_polled_at).toEqual(expect.any(String));
  });

  it("treats an in-flight approval as authorization_pending", async () => {
    seedCode(db, { status: "approving" });
    expect((await (await poll()).json()).error).toBe("authorization_pending");
  });

  it("returns slow_down when polled faster than the interval", async () => {
    seedCode(db, { last_polled_at: new Date(Date.now() - 1000).toISOString() });
    const response = await poll();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "slow_down",
      interval: MIN_POLL_INTERVAL_SECONDS + 5,
    });
  });

  it("does not hand out the token on a slow_down poll", async () => {
    seedApproved(db, { last_polled_at: new Date(Date.now() - 1000).toISOString() });
    expect((await (await poll()).json()).error).toBe("slow_down");
    expect(db.tables.device_auth_codes).toHaveLength(1);
  });

  it("allows polling again once the interval has passed", async () => {
    seedCode(db, {
      last_polled_at: new Date(Date.now() - (MIN_POLL_INTERVAL_SECONDS + 1) * 1000).toISOString(),
    });
    expect((await (await poll()).json()).error).toBe("authorization_pending");
  });

  it("returns slow_down to the loser of two simultaneous polls", async () => {
    seedCode(db);
    const bodies = await Promise.all([poll(), poll()].map(async (p) => (await p).json()));
    expect(bodies.map((b) => b.error).sort()).toEqual(["authorization_pending", "slow_down"]);
  });

  it("returns the token exactly once and deletes the row", async () => {
    seedApproved(db);

    const response = await poll();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ access_token: RAW_KEY, token_type: "Bearer" });
    expect(db.tables.device_auth_codes).toHaveLength(0);
    // The delivered key stays active.
    expect(db.tables.agent_api_keys).toHaveLength(1);

    const second = await poll();
    expect(second.status).toBe(400);
    expect((await second.json()).error).toBe("invalid_grant");
  });

  it("delivers the token to exactly one of several concurrent pollers", async () => {
    seedApproved(db);
    // All four read the same row; the throttle compare-and-set lets one
    // through and the rest get slow_down.
    const responses = await Promise.all(Array.from({ length: 4 }, () => poll()));
    const bodies = await Promise.all(responses.map((r) => r.json()));
    const tokens = bodies.filter((b) => b.access_token);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].access_token).toBe(RAW_KEY);
    expect(bodies.filter((b) => !b.access_token).every((b) => b.error)).toBe(true);
  });

  it("only one poller receives the token even when both pass the throttle", async () => {
    seedApproved(db);
    // Make the throttle compare-and-set always succeed so both requests
    // reach the consume step; the conditional DELETE must still pick one.
    const originalFrom = db.from.bind(db);
    jest.spyOn(db, "from").mockImplementation((table: string) => {
      const query = originalFrom(table);
      const originalIs = query.is.bind(query);
      query.is = (column: string, value: null) =>
        column === "last_polled_at" ? query : originalIs(column, value);
      return query;
    });

    const bodies = await Promise.all([poll(), poll()].map(async (p) => (await p).json()));
    expect(bodies.filter((b) => b.access_token)).toHaveLength(1);
    expect(bodies.filter((b) => b.error === "invalid_grant")).toHaveLength(1);
  });

  it("returns expired_token and marks a pending row expired", async () => {
    seedCode(db, { expires_at: new Date(Date.now() - 1000).toISOString() });
    const response = await poll();
    expect((await response.json()).error).toBe("expired_token");
    expect(db.tables.device_auth_codes[0].status).toBe("expired");
  });

  it("returns expired_token for an already expired row", async () => {
    seedCode(db, { status: "expired" });
    expect((await (await poll()).json()).error).toBe("expired_token");
  });

  it("removes an approved-but-undelivered key when the code expires", async () => {
    seedApproved(db, { expires_at: new Date(Date.now() - 1000).toISOString() });
    const response = await poll();
    expect((await response.json()).error).toBe("expired_token");
    expect(db.tables.device_auth_codes).toHaveLength(0);
    expect(db.tables.agent_api_keys).toHaveLength(0);
  });

  it("returns server_error and removes the key when the ciphertext is corrupt", async () => {
    seedApproved(db, { api_key_raw_encrypted: "bad:cipher:text" });
    const response = await poll();
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("server_error");
    expect(db.tables.agent_api_keys).toHaveLength(0);
  });

  it("returns invalid_grant and removes the key when an approved row has no ciphertext", async () => {
    seedApproved(db, { api_key_raw_encrypted: null });
    expect((await (await poll()).json()).error).toBe("invalid_grant");
    expect(db.tables.agent_api_keys).toHaveLength(0);
  });

  it("returns server_error when the lookup fails", async () => {
    seedCode(db);
    db.failNext("device_auth_codes", "select");
    const response = await poll();
    expect(response.status).toBe(500);
  });

  it("returns a clear 500 without consuming the row when the encryption key is missing", async () => {
    seedApproved(db);
    delete process.env.DEVICE_AUTH_ENCRYPTION_KEY;

    const response = await poll();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "server_error",
      error_description: DEVICE_AUTH_NOT_CONFIGURED_MESSAGE,
    });
    expect(db.tables.device_auth_codes).toHaveLength(1);

    // Once configured again, the same device can still pick up its token.
    process.env.DEVICE_AUTH_ENCRYPTION_KEY = TEST_KEY;
    expect((await (await poll()).json()).access_token).toBe(RAW_KEY);
  });

  it("supports the full create → approve → poll flow", async () => {
    mockCreateSupabaseClient.mockResolvedValue({
      auth: {
        getUser: jest
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-9" } }, error: null }),
      },
    });

    const created = await (
      await createCode(
        new NextRequest("http://localhost/api/auth/device", {
          method: "POST",
          body: JSON.stringify({}),
        }),
      )
    ).json();

    expect((await (await poll(created.device_code)).json()).error).toBe(
      "authorization_pending",
    );

    const approved = await approve(
      new NextRequest("http://localhost/api/auth/device/approve", {
        method: "POST",
        body: JSON.stringify({ user_code: created.user_code }),
      }),
    );
    expect(approved.status).toBe(200);

    // Let the poll interval elapse.
    db.tables.device_auth_codes[0].last_polled_at = new Date(
      Date.now() - (MIN_POLL_INTERVAL_SECONDS + 1) * 1000,
    ).toISOString();

    const token = await (await poll(created.device_code)).json();
    expect(token.access_token).toMatch(/^mm_sk_/);
    expect(db.tables.agent_api_keys).toHaveLength(1);
    expect(db.tables.agent_api_keys[0].user_id).toBe("user-9");
    expect(db.tables.device_auth_codes).toHaveLength(0);
  });
});
