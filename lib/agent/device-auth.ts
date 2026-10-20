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

export type DeviceAuthStatus = "pending" | "approved" | "expired";

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

// --- Encryption (AES-256-GCM) ---

function getEncryptionKey(): Buffer {
  const hex = process.env.DEVICE_AUTH_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
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
