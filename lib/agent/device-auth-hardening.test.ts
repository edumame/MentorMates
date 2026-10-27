/**
 * @jest-environment node
 */

import {
  approveRateLimitBucket,
  createCodeRateLimitBucket,
  DeviceAuthRateLimitUnavailableError,
  encryptApiKey,
  generateUserCode,
  getClientIp,
  isDeviceAuthConfigured,
  normalizeUserCode,
  reserveDeviceAuthAttempt,
} from "./device-auth";
import { buildDeviceLoginUrl } from "./device-auth-url";

describe("device-auth hardening helpers", () => {
  const originalKey = process.env.DEVICE_AUTH_ENCRYPTION_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.DEVICE_AUTH_ENCRYPTION_KEY;
    else process.env.DEVICE_AUTH_ENCRYPTION_KEY = originalKey;
  });

  describe("isDeviceAuthConfigured", () => {
    it.each([
      [undefined, false],
      ["", false],
      ["a".repeat(63), false],
      ["a".repeat(65), false],
      ["g".repeat(64), false],
      ["A1".repeat(32), true],
    ])("key %p → %p", (value, expected) => {
      if (value === undefined) delete process.env.DEVICE_AUTH_ENCRYPTION_KEY;
      else process.env.DEVICE_AUTH_ENCRYPTION_KEY = value;
      expect(isDeviceAuthConfigured()).toBe(expected);
    });

    it("encryptApiKey rejects a non-hex 64-char key", () => {
      process.env.DEVICE_AUTH_ENCRYPTION_KEY = "z".repeat(64);
      expect(() => encryptApiKey("x")).toThrow(/64-char hex/);
    });
  });

  describe("normalizeUserCode", () => {
    it.each([
      ["abcd2345", "ABCD2345"],
      [" ABCD-2345 ", "ABCD2345"],
      ["ABCD234", null],
      ["ABCD23456", null],
      ["ABCDO000", null],
      ["ABCDI111", null],
      [12345678, null],
      [null, null],
    ])("%p → %p", (input, expected) => {
      expect(normalizeUserCode(input)).toBe(expected);
    });

    it("accepts every generated code", () => {
      for (let i = 0; i < 50; i++) {
        const code = generateUserCode();
        expect(normalizeUserCode(code)).toBe(code);
      }
    });
  });

  describe("getClientIp", () => {
    it("uses the first x-forwarded-for entry", () => {
      expect(getClientIp(new Headers({ "x-forwarded-for": " 1.2.3.4 , 10.0.0.1" }))).toBe(
        "1.2.3.4",
      );
    });

    it("falls back to x-real-ip, then 'unknown'", () => {
      expect(getClientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
      expect(getClientIp(new Headers())).toBe("unknown");
    });
  });

  describe("rate limit buckets", () => {
    it("hashes IPs and keys approvals by user", () => {
      expect(createCodeRateLimitBucket("1.2.3.4")).toMatch(/^create:ip:[0-9a-f]{64}$/);
      expect(createCodeRateLimitBucket("1.2.3.4")).toBe(createCodeRateLimitBucket("1.2.3.4"));
      expect(createCodeRateLimitBucket("1.2.3.4")).not.toBe(createCodeRateLimitBucket("1.2.3.5"));
      expect(approveRateLimitBucket("u1")).toBe("approve:user:u1");
    });
  });

  describe("reserveDeviceAuthAttempt", () => {
    const clientReturning = (result: { data: unknown; error: unknown }) => ({
      rpc: jest.fn().mockResolvedValue(result),
    });

    it("passes bucket, limit and window to the RPC", async () => {
      const client = clientReturning({
        data: [{ allowed: true, retry_after_seconds: 0 }],
        error: null,
      });
      await expect(reserveDeviceAuthAttempt(client, "b", 3, 60)).resolves.toEqual({
        allowed: true,
        retryAfterSeconds: 0,
      });
      expect(client.rpc).toHaveBeenCalledWith("reserve_device_auth_attempt", {
        p_bucket: "b",
        p_limit: 3,
        p_window_seconds: 60,
      });
    });

    it("returns a denial with retry-after", async () => {
      const client = clientReturning({
        data: [{ allowed: false, retry_after_seconds: 30 }],
        error: null,
      });
      await expect(reserveDeviceAuthAttempt(client, "b", 3, 60)).resolves.toEqual({
        allowed: false,
        retryAfterSeconds: 30,
      });
    });

    it.each([
      ["an RPC error", { data: null, error: { message: "x" } }],
      ["no rows", { data: [], error: null }],
      ["non-array data", { data: { allowed: true }, error: null }],
      ["a malformed row", { data: [{ allowed: "yes", retry_after_seconds: 0 }], error: null }],
      ["a negative retry", { data: [{ allowed: true, retry_after_seconds: -1 }], error: null }],
      ["a fractional retry", { data: [{ allowed: false, retry_after_seconds: 1.5 }], error: null }],
      ["a denial without retry", { data: [{ allowed: false, retry_after_seconds: 0 }], error: null }],
    ])("fails closed on %s", async (_label, result) => {
      await expect(
        reserveDeviceAuthAttempt(clientReturning(result), "b", 3, 60),
      ).rejects.toBeInstanceOf(DeviceAuthRateLimitUnavailableError);
    });

    it("fails closed when the RPC throws", async () => {
      const client = { rpc: jest.fn().mockRejectedValue(new Error("network")) };
      await expect(reserveDeviceAuthAttempt(client, "b", 3, 60)).rejects.toBeInstanceOf(
        DeviceAuthRateLimitUnavailableError,
      );
    });
  });

  describe("buildDeviceLoginUrl", () => {
    it("encodes the nested return URL so the code survives /login", () => {
      const url = buildDeviceLoginUrl("ABCD2345");
      expect(url).toBe("/login?returnUrl=%2Fauth%2Fdevice%3Fcode%3DABCD2345");
      const parsed = new URL(url, "https://example.test");
      expect(parsed.searchParams.get("returnUrl")).toBe("/auth/device?code=ABCD2345");
      expect(Array.from(parsed.searchParams.keys())).toEqual(["returnUrl"]);
    });

    it("omits the code when empty", () => {
      expect(buildDeviceLoginUrl("")).toBe("/login?returnUrl=%2Fauth%2Fdevice");
    });
  });
});
