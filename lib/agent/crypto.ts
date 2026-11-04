import { createHash, randomBytes } from "crypto";

/**
 * Generate a new API key. Returns the raw key (show once) and hash (store in DB).
 */
export function generateApiKey(keyPrefix = "mm_sk_"): { raw: string; hash: string; prefix: string } {
  const raw = `${keyPrefix}${randomBytes(32).toString("hex")}`;
  const hash = hashApiKey(raw);
  const prefix = raw.slice(0, keyPrefix.length + 8);
  return { raw, hash, prefix };
}

/**
 * Hash an API key for storage/lookup.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
