import {
  generateUserCode,
  generateDeviceCode,
  encryptApiKey,
  decryptApiKey,
  DEVICE_CODE_TTL_SECONDS,
  MIN_POLL_INTERVAL_SECONDS,
  USER_CODE_ALPHABET,
} from "./device-auth";

describe("device-auth", () => {
  describe("generateUserCode", () => {
    it("returns an 8-character string", () => {
      const code = generateUserCode();
      expect(code).toHaveLength(8);
    });

    it("only contains characters from USER_CODE_ALPHABET", () => {
      for (let i = 0; i < 50; i++) {
        const code = generateUserCode();
        for (const char of code) {
          expect(USER_CODE_ALPHABET).toContain(char);
        }
      }
    });

    it("never contains ambiguous characters (O, 0, I, 1)", () => {
      for (let i = 0; i < 100; i++) {
        const code = generateUserCode();
        expect(code).not.toMatch(/[O0I1]/);
      }
    });

    it("produces unique codes across 100 generations", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateUserCode());
      }
      expect(codes.size).toBe(100);
    });
  });

  describe("generateDeviceCode", () => {
    it("returns raw code and SHA-256 hash", () => {
      const { raw, hash } = generateDeviceCode();
      expect(raw).toBeTruthy();
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("hash is deterministic for the same raw input", async () => {
      const { raw, hash } = generateDeviceCode();
      const crypto = await import("crypto");
      const expected = crypto.createHash("sha256").update(raw).digest("hex");
      expect(hash).toBe(expected);
    });

    it("produces unique codes", () => {
      const a = generateDeviceCode();
      const b = generateDeviceCode();
      expect(a.raw).not.toBe(b.raw);
      expect(a.hash).not.toBe(b.hash);
    });
  });

  describe("encryptApiKey / decryptApiKey", () => {
    const testKey = "mm_sk_abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678";

    beforeAll(() => {
      // Set encryption key for tests (32 bytes hex = 64 chars)
      process.env.DEVICE_AUTH_ENCRYPTION_KEY =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    });

    afterAll(() => {
      delete process.env.DEVICE_AUTH_ENCRYPTION_KEY;
    });

    it("round-trips correctly", () => {
      const encrypted = encryptApiKey(testKey);
      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe(testKey);
    });

    it("encrypted output is different from plaintext", () => {
      const encrypted = encryptApiKey(testKey);
      expect(encrypted).not.toBe(testKey);
    });

    it("different encryptions of the same key produce different ciphertexts (random IV)", () => {
      const a = encryptApiKey(testKey);
      const b = encryptApiKey(testKey);
      expect(a).not.toBe(b);
    });

    it("throws on decrypt with wrong key", () => {
      const encrypted = encryptApiKey(testKey);
      process.env.DEVICE_AUTH_ENCRYPTION_KEY =
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      expect(() => decryptApiKey(encrypted)).toThrow();
      // Restore
      process.env.DEVICE_AUTH_ENCRYPTION_KEY =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    });
  });

  describe("constants", () => {
    it("TTL is 15 minutes", () => {
      expect(DEVICE_CODE_TTL_SECONDS).toBe(900);
    });

    it("minimum poll interval is 5 seconds", () => {
      expect(MIN_POLL_INTERVAL_SECONDS).toBe(5);
    });
  });
});
