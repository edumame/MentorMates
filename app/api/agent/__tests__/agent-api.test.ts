/**
 * Agent API auth and scope tests.
 *
 * Pure function tests that don't require Next.js runtime.
 * Full integration tests (with HTTP requests) should use Playwright.
 */

import { generateApiKey, hashApiKey } from "@/lib/agent/crypto";

describe("Agent API Key Generation", () => {
  it("generates a key with mm_sk_ prefix and correct length", () => {
    const { raw, hash, prefix } = generateApiKey();
    expect(raw).toMatch(/^mm_sk_[a-f0-9]{64}$/);
    expect(hash).toHaveLength(64);
    expect(prefix).toBe(raw.slice(0, 14));
  });

  it("generates unique keys", () => {
    const keys = new Set(
      Array.from({ length: 10 }, () => generateApiKey().raw)
    );
    expect(keys.size).toBe(10);
  });
});

describe("API Key Hashing", () => {
  it("produces consistent hashes", () => {
    const key = "mm_sk_test123";
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  it("produces different hashes for different keys", () => {
    expect(hashApiKey("mm_sk_key1")).not.toBe(hashApiKey("mm_sk_key2"));
  });

  it("produces 64-char hex string (SHA-256)", () => {
    const hash = hashApiKey("mm_sk_anything");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("Scope validation (pure logic)", () => {
  // Replicates the hasScope logic from lib/agent/auth.ts
  const hasScope = (scopes: string[], scope: string) => scopes.includes(scope);

  it("returns true for present scope", () => {
    expect(hasScope(["event:read", "event:write"], "event:read")).toBe(true);
  });

  it("returns false for missing scope", () => {
    expect(hasScope(["event:read"], "event:write")).toBe(false);
  });

  it("returns false for empty scopes", () => {
    expect(hasScope([], "event:read")).toBe(false);
  });

  it("handles all default scopes", () => {
    const defaultScopes = [
      "event:read",
      "event:write",
      "participants:read",
      "participants:write",
      "projects:read",
      "projects:write",
    ];
    defaultScopes.forEach((scope) => {
      expect(hasScope(defaultScopes, scope)).toBe(true);
    });
  });
});

describe("API Key format validation", () => {
  it("valid keys start with mm_sk_", () => {
    const { raw } = generateApiKey();
    expect(raw.startsWith("mm_sk_")).toBe(true);
  });

  it("rejects keys without prefix", () => {
    const isValid = (key: string) => key.startsWith("mm_sk_");
    expect(isValid("sk_test123")).toBe(false);
    expect(isValid("bearer_abc")).toBe(false);
    expect(isValid("")).toBe(false);
  });
});
