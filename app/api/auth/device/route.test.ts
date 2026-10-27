/**
 * @jest-environment node
 */

import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  CREATE_CODE_LIMIT_PER_IP,
  DEVICE_AUTH_NOT_CONFIGURED_MESSAGE,
  DEVICE_CODE_TTL_SECONDS,
  MAX_PENDING_DEVICE_CODES,
  MIN_POLL_INTERVAL_SECONDS,
  USER_CODE_PATTERN,
} from "@/lib/agent/device-auth";
import { FakeSupabase } from "./_test/fake-supabase";
import { POST } from "./route";

jest.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const mockServiceClient = createSupabaseServiceClient as jest.Mock;
const TEST_KEY = "a".repeat(64);

function createRequest(body?: unknown, ip = "203.0.113.7") {
  return new NextRequest("http://localhost/api/auth/device", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `${ip}, 10.0.0.1` },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/auth/device", () => {
  const originalEnv = process.env;
  let db: FakeSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    process.env = {
      ...originalEnv,
      DEVICE_AUTH_ENCRYPTION_KEY: TEST_KEY,
      NEXT_PUBLIC_APP_URL: "https://mentormates.test",
    };
    db = new FakeSupabase();
    mockServiceClient.mockReturnValue(db);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("creates a pending participant code and stores only the device code hash", async () => {
    const before = Date.now();
    const response = await POST(createRequest({}));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user_code).toMatch(USER_CODE_PATTERN);
    expect(body.device_code).toMatch(/^[0-9a-f]{64}$/);
    expect(body.verification_uri).toBe("https://mentormates.test/auth/device");
    expect(body.verification_uri_complete).toBe(
      `https://mentormates.test/auth/device?code=${body.user_code}`,
    );
    expect(body.expires_in).toBe(DEVICE_CODE_TTL_SECONDS);
    expect(body.interval).toBe(MIN_POLL_INTERVAL_SECONDS);

    expect(db.tables.device_auth_codes).toHaveLength(1);
    const row = db.tables.device_auth_codes[0];
    expect(row.device_code_hash).toBe(
      createHash("sha256").update(body.device_code).digest("hex"),
    );
    expect(row).not.toHaveProperty("device_code");
    expect(row.access_mode).toBe("participant");
    expect(row.status).toBe("pending");
    const expiresAt = Date.parse(row.expires_at as string);
    expect(expiresAt).toBeGreaterThanOrEqual(before + DEVICE_CODE_TTL_SECONDS * 1000);
  });

  it("records an organizer request (authorization happens at approval)", async () => {
    const response = await POST(createRequest({ access_mode: "organizer" }));
    expect(response.status).toBe(200);
    expect(db.tables.device_auth_codes[0].access_mode).toBe("organizer");
  });

  it.each([
    ["no body", undefined],
    ["invalid JSON", "{not json"],
    ["unknown access mode", { access_mode: "admin" }],
    ["null body", "null"],
  ])("defaults to participant mode for %s", async (_label, body) => {
    const response = await POST(createRequest(body));
    expect(response.status).toBe(200);
    expect(db.tables.device_auth_codes[0].access_mode).toBe("participant");
  });

  it("rate limits code creation per client IP with 429 and Retry-After", async () => {
    for (let i = 0; i < CREATE_CODE_LIMIT_PER_IP; i++) {
      expect((await POST(createRequest({}))).status).toBe(200);
    }

    const limited = await POST(createRequest({}));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("120");
    expect((await limited.json()).error).toBe("slow_down");
    expect(db.tables.device_auth_codes).toHaveLength(CREATE_CODE_LIMIT_PER_IP);

    // A different client IP has its own bucket.
    expect((await POST(createRequest({}, "198.51.100.9"))).status).toBe(200);
  });

  it("never stores the raw client IP in the rate limit bucket", async () => {
    await POST(createRequest({}));
    const [bucket] = Array.from(db.rateLimits.keys());
    expect(bucket).toMatch(/^create:ip:[0-9a-f]{64}$/);
    expect(bucket).not.toContain("203.0.113.7");
  });

  it("rejects with 503 when the global pending-code cap is reached", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    for (let i = 0; i < MAX_PENDING_DEVICE_CODES; i++) {
      db.tables.device_auth_codes.push({
        id: `seed-${i}`,
        device_code_hash: `hash-${i}`,
        user_code: `CODE${i}`,
        status: "pending",
        expires_at: future,
      });
    }

    const response = await POST(createRequest({}));
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(db.tables.device_auth_codes).toHaveLength(MAX_PENDING_DEVICE_CODES);
  });

  it("does not count expired or non-pending codes toward the cap", async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    for (let i = 0; i < MAX_PENDING_DEVICE_CODES; i++) {
      db.tables.device_auth_codes.push({
        id: `seed-${i}`,
        device_code_hash: `hash-${i}`,
        user_code: `CODE${i}`,
        status: i % 2 === 0 ? "pending" : "approved",
        expires_at: i % 2 === 0 ? past : future,
      });
    }

    expect((await POST(createRequest({}))).status).toBe(200);
  });

  it("fails closed with 503 when the rate limit RPC errors", async () => {
    db.rpcFailures.set("reserve_device_auth_attempt", { message: "db down" });
    const response = await POST(createRequest({}));
    expect(response.status).toBe(503);
    expect(db.tables.device_auth_codes).toHaveLength(0);
  });

  it("fails closed with 503 when the pending-code count errors", async () => {
    db.failNext("device_auth_codes", "select");
    const response = await POST(createRequest({}));
    expect(response.status).toBe(503);
    expect(db.tables.device_auth_codes).toHaveLength(0);
  });

  it("retries on user_code collisions", async () => {
    db.failNext("device_auth_codes", "insert", {
      message: "duplicate key value violates unique constraint",
      code: "23505",
    });
    const response = await POST(createRequest({}));
    expect(response.status).toBe(200);
    expect(db.tables.device_auth_codes).toHaveLength(1);
  });

  it("gives up after repeated collisions", async () => {
    for (let i = 0; i < 3; i++) {
      db.failNext("device_auth_codes", "insert", { message: "unique violation", code: "23505" });
    }
    const response = await POST(createRequest({}));
    expect(response.status).toBe(500);
    expect(db.tables.device_auth_codes).toHaveLength(0);
  });

  it("returns 500 on non-collision insert errors", async () => {
    db.failNext("device_auth_codes", "insert", { message: "connection reset", code: "08006" });
    const response = await POST(createRequest({}));
    expect(response.status).toBe(500);
  });

  it.each([
    ["missing", undefined],
    ["too short", "abc123"],
    ["not hex", "z".repeat(64)],
  ])("returns a clear 500 when DEVICE_AUTH_ENCRYPTION_KEY is %s", async (_label, value) => {
    if (value === undefined) delete process.env.DEVICE_AUTH_ENCRYPTION_KEY;
    else process.env.DEVICE_AUTH_ENCRYPTION_KEY = value;

    const response = await POST(createRequest({}));
    expect(response.status).toBe(500);
    expect((await response.json()).error_description).toBe(DEVICE_AUTH_NOT_CONFIGURED_MESSAGE);
    expect(db.tables.device_auth_codes).toHaveLength(0);
    expect(db.rateLimits.size).toBe(0);
  });
});
