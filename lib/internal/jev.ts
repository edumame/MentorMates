/**
 * Internal, invite-gated proxy for Typesafe's Jev model (via OpenRouter).
 *
 * Pure helpers live here so the route stays thin and the rules are unit-tested:
 *   - checkInvite: is this invite usable for this service right now?
 *   - decideRateLimit: sliding-window "N calls per minute per API key".
 *   - buildUpstreamBody: validate the caller's chat payload and pin the model.
 */

export const JEV_SERVICE = "jev";
export const JEV_MODEL = process.env.JEV_MODEL || "typesafe/jev-1.13";
export const JEV_RATE_LIMIT = Number(process.env.INTERNAL_JEV_RATE_LIMIT || 5);
export const JEV_WINDOW_MS = 60_000;
export const JEV_MAX_BODY_BYTES = 32 * 1024;

export type InviteRow = {
  id: string;
  code: string;
  service: string;
  revoked_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
};

export type InviteCheck =
  | { ok: true }
  | { ok: false; reason: "not_found" | "revoked" | "expired" | "exhausted" };

export function checkInvite(
  invite: InviteRow | null | undefined,
  service: string,
  now: Date = new Date()
): InviteCheck {
  if (!invite || invite.service !== service) return { ok: false, reason: "not_found" };
  if (invite.revoked_at) return { ok: false, reason: "revoked" };
  if (invite.expires_at && new Date(invite.expires_at) <= now) return { ok: false, reason: "expired" };
  if (invite.max_uses !== null && invite.uses >= invite.max_uses) return { ok: false, reason: "exhausted" };
  return { ok: true };
}

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
};

/**
 * @param callsInWindow number of forwarded calls this key made in the last window
 * @param oldestInWindow timestamp of the oldest of those calls (needed only when blocking)
 */
export function decideRateLimit(
  callsInWindow: number,
  opts: { limit?: number; windowMs?: number; oldestInWindow?: Date; now?: Date } = {}
): RateLimitDecision {
  const limit = opts.limit ?? JEV_RATE_LIMIT;
  const windowMs = opts.windowMs ?? JEV_WINDOW_MS;
  if (callsInWindow < limit) return { allowed: true, remaining: limit - callsInWindow - 1 };
  const now = opts.now ?? new Date();
  const oldest = opts.oldestInWindow ?? now;
  const msUntilFree = oldest.getTime() + windowMs - now.getTime();
  return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil(msUntilFree / 1000)) };
}

type ChatMessage = { role: "user" | "assistant"; content: string };
export type UpstreamBody = {
  model: string;
  messages: ChatMessage[];
  stream: false;
  response_format?: unknown;
  temperature?: number;
  max_tokens?: number;
};

export function buildUpstreamBody(input: unknown): UpstreamBody {
  if (!input || typeof input !== "object") throw new Error("Body must be a JSON object with messages");
  const raw = input as Record<string, unknown>;
  if (raw.stream) throw new Error("stream is not supported on this endpoint");
  const messages = raw.messages;
  if (!Array.isArray(messages) || messages.length === 0) throw new Error("messages[] is required");
  if (messages.length > 50) throw new Error("messages[] is limited to 50 entries");
  const clean: ChatMessage[] = messages.map((m) => {
    if (!m || typeof m !== "object") throw new Error("Each message needs a role and content");
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") throw new Error("role must be user or assistant");
    if (typeof content !== "string" || !content) throw new Error("content must be a non-empty string");
    return { role, content };
  });
  const body: UpstreamBody = { model: JEV_MODEL, messages: clean, stream: false };
  if (raw.response_format !== undefined) body.response_format = raw.response_format;
  if (typeof raw.temperature === "number") body.temperature = raw.temperature;
  if (typeof raw.max_tokens === "number") body.max_tokens = Math.min(raw.max_tokens, 4096);
  if (JSON.stringify(body).length > JEV_MAX_BODY_BYTES) throw new Error("Payload must be under 32 KB");
  return body;
}
