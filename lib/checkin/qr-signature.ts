import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// Event and user ids are readable through user_event_roles, so they prove
// nothing on their own. Only the server can issue this signature, and only the
// ticket email (sent to the attendee's own address) carries it.
export function signCheckinQR(eventId: string, userId: string): string {
  const secret = process.env.CHECKIN_QR_SECRET;

  if (!secret) {
    throw new Error("CHECKIN_QR_SECRET is not configured");
  }

  return createHmac("sha256", secret)
    .update(`checkin-qr:v1:${eventId}:${userId}`)
    .digest("hex");
}

// Throws when the secret is missing, so a misconfigured server reports an
// error instead of telling staff that every genuine ticket is invalid.
export function isValidCheckinQRSignature(
  eventId: string,
  userId: string,
  signature: string | null
): boolean {
  const expected = Buffer.from(signCheckinQR(eventId, userId));
  const actual = Buffer.from(signature ?? "");

  // timingSafeEqual throws on buffers of different lengths.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
