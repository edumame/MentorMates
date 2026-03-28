import { generateApiKey, hashApiKey } from "./crypto";

describe("Agent API Key Auth", () => {
  describe("generateApiKey", () => {
    it("generates a key with mm_sk_ prefix", () => {
      const { raw, hash, prefix } = generateApiKey();
      expect(raw).toMatch(/^mm_sk_[a-f0-9]{64}$/);
      expect(hash).toHaveLength(64); // SHA-256 hex
      expect(prefix).toBe(raw.slice(0, 14));
    });

    it("generates unique keys each time", () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1.raw).not.toBe(key2.raw);
      expect(key1.hash).not.toBe(key2.hash);
    });
  });

  describe("hashApiKey", () => {
    it("produces consistent hashes", () => {
      const key = "mm_sk_test123";
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different keys", () => {
      const hash1 = hashApiKey("mm_sk_key1");
      const hash2 = hashApiKey("mm_sk_key2");
      expect(hash1).not.toBe(hash2);
    });
  });
});
