export const MAX_REQUEST_BYTES = 256 * 1024;
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
export const BODY_TIMEOUT_MS = 10_000;

function positiveInteger(name: string, fallback: number, max: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new Error(`Invalid ${name} configuration`);
  }
  return value;
}

export function getGatewayConfig() {
  return {
    minuteLimit: positiveInteger(
      "MODEL_API_REQUESTS_PER_MINUTE",
      60,
      1_000_000,
    ),
    dayLimit: positiveInteger("MODEL_API_REQUESTS_PER_DAY", 1_000, 10_000_000),
    timeoutMs: positiveInteger("MODEL_API_TIMEOUT_MS", 15_000, 30_000),
  };
}
