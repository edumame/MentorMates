import { createHash, randomBytes } from "crypto";

/**
 * Generate a new API key. Returns the raw key (show once) and hash (store in DB).
 */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `mm_sk_${randomBytes(32).toString("hex")}`;
  const hash = hashApiKey(raw);
  const prefix = raw.slice(0, 14); // "mm_sk_" + 8 chars
  return { raw, hash, prefix };
}

/**
 * Hash an API key for storage/lookup.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
