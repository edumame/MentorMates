import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "crypto";

// --- Types ---

export interface DeviceAuthCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

/**
 * "approving" is a short-lived claim held by exactly one approve request while
 * it mints the API key (see 202610270001_device_auth_hardening.sql).
 */
export type DeviceAuthStatus = "pending" | "approving" | "approved" | "expired";

export interface DeviceAuthRow {
  id: string;
  device_code_hash: string;
  user_code: string;
  user_id: string | null;
  access_mode: "organizer" | "participant";
  status: DeviceAuthStatus;
  api_key_id: string | null;
  api_key_raw_encrypted: string | null;
  expires_at: string;
  last_polled_at: string | null;
  created_at: string;
}

// --- Constants ---

export const DEVICE_CODE_TTL_SECONDS = 900; // 15 minutes
export const MIN_POLL_INTERVAL_SECONDS = 5;
export const USER_CODE_LENGTH = 8;
export const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1
export const USER_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

// Rate limits (enforced by the reserve_device_auth_attempt RPC).
export const CREATE_CODE_LIMIT_PER_IP = 10;
export const CREATE_CODE_WINDOW_SECONDS = 15 * 60;
/** Global cap on outstanding (pending, unexpired) codes across all clients. */
export const MAX_PENDING_DEVICE_CODES = 500;
/** Lookups and approvals both count; a normal approval uses two attempts. */
export const APPROVE_ATTEMPT_LIMIT_PER_USER = 20;
export const APPROVE_ATTEMPT_WINDOW_SECONDS = 15 * 60;

export const DEVICE_AUTH_NOT_CONFIGURED_MESSAGE =
  "Device authorization is not configured on this server";

// --- Code generation ---

export function generateUserCode(): string {
  const bytes = randomBytes(USER_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < USER_CODE_LENGTH; i++) {
    code += USER_CODE_ALPHABET[bytes[i] % USER_CODE_ALPHABET.length];
  }
  return code;
}

export function generateDeviceCode(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function normalizeUserCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase().replace(/[\s-]/g, "");
  return USER_CODE_PATTERN.test(normalized) ? normalized : null;
}

// --- Encryption (AES-256-GCM) ---

const ENCRYPTION_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

/**
 * True when DEVICE_AUTH_ENCRYPTION_KEY is a 64-char hex string. Routes check
 * this up front so a misconfigured server fails before any state changes
 * (e.g. before a token row is consumed or an API key is minted).
 */
export function isDeviceAuthConfigured(): boolean {
  return ENCRYPTION_KEY_PATTERN.test(process.env.DEVICE_AUTH_ENCRYPTION_KEY ?? "");
}

function getEncryptionKey(): Buffer {
  const hex = process.env.DEVICE_AUTH_ENCRYPTION_KEY;
  if (!hex || !ENCRYPTION_KEY_PATTERN.test(hex)) {
    throw new Error(
      "DEVICE_AUTH_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptApiKey(raw: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(raw, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptApiKey(encrypted: string): string {
  const key = getEncryptionKey();
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Invalid encrypted format");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

// --- Rate limiting ---

/**
 * Best-effort client IP. On Vercel the first x-forwarded-for entry is set by
 * the platform; elsewhere it may be spoofable, so the global pending-code cap
 * remains the backstop.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/** Hash IPs so raw addresses are never stored in the rate limit table. */
export function createCodeRateLimitBucket(ip: string): string {
  return `create:ip:${createHash("sha256").update(ip).digest("hex")}`;
}

export function approveRateLimitBucket(userId: string): string {
  return `approve:user:${userId}`;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export class DeviceAuthRateLimitUnavailableError extends Error {
  constructor() {
    super("Rate limiting is temporarily unavailable");
  }
}

export interface DeviceAuthRateLimitClient {
  rpc(
    name: "reserve_device_auth_attempt",
    args: { p_bucket: string; p_limit: number; p_window_seconds: number },
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

/**
 * Atomically reserve one attempt. Fails closed: any RPC error or malformed
 * response throws DeviceAuthRateLimitUnavailableError (callers return 503).
 */
export async function reserveDeviceAuthAttempt(
  client: DeviceAuthRateLimitClient,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitDecision> {
  let result: { data: unknown; error: unknown };
  try {
    result = await client.rpc("reserve_device_auth_attempt", {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
  } catch {
    throw new DeviceAuthRateLimitUnavailableError();
  }
  if (result.error || !Array.isArray(result.data) || result.data.length !== 1) {
    throw new DeviceAuthRateLimitUnavailableError();
  }
  const row = result.data[0] as { allowed?: unknown; retry_after_seconds?: unknown };
  if (
    typeof row.allowed !== "boolean" ||
    typeof row.retry_after_seconds !== "number" ||
    !Number.isInteger(row.retry_after_seconds) ||
    row.retry_after_seconds < 0
  ) {
    throw new DeviceAuthRateLimitUnavailableError();
  }
  if (!row.allowed && row.retry_after_seconds < 1) {
    throw new DeviceAuthRateLimitUnavailableError();
  }
  return { allowed: row.allowed, retryAfterSeconds: row.retry_after_seconds };
}
