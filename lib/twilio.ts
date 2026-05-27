import TwilioModule, { type Twilio } from "twilio";

let cachedClient: Twilio | null = null;

function getClient(): Twilio {
  if (cachedClient) return cachedClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("Twilio credentials are not configured");
  }
  cachedClient = TwilioModule(sid, token);
  return cachedClient;
}

function getVerifyServiceSid(): string {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!serviceSid) throw new Error("TWILIO_VERIFY_SERVICE_SID not configured");
  return serviceSid;
}

function getFromNumber(): string {
  const from = process.env.TWILIO_SMS_NUMBER;
  if (!from) throw new Error("TWILIO_SMS_NUMBER not configured");
  return from;
}

// Strip everything except digits and a leading '+'. Does NOT validate
// country code; Twilio Verify will reject bad numbers.
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.slice(1).replace(/\D/g, "");
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

export async function startPhoneVerification(phone: string): Promise<void> {
  await getClient()
    .verify.v2.services(getVerifyServiceSid())
    .verifications.create({ to: phone, channel: "sms" });
}

export async function checkPhoneVerification(
  phone: string,
  code: string
): Promise<boolean> {
  const result = await getClient()
    .verify.v2.services(getVerifyServiceSid())
    .verificationChecks.create({ to: phone, code });
  return result.status === "approved";
}

export async function sendSms(to: string, body: string): Promise<void> {
  await getClient().messages.create({ to, from: getFromNumber(), body });
}
