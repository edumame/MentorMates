/**
 * Internal, invite-gated proxy for Typesafe's Jev API (POST /v1/systemone).
 *
 * Pure helpers live here so the route stays thin and the rules are unit-tested:
 *   - checkInvite: is this invite usable for this service right now?
 *   - decideRateLimit: sliding-window "N calls per minute per API key".
 *   - buildUpstreamBody: validate the caller's chat payload and pin the model.
 */

export const JEV_SERVICE = "jev";
export const JEV_MODEL = process.env.JEV_MODEL || "jev-latest";
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

export type JevQuestionType = "noul" | "choice" | "score";
export type JevQuestion = {
  type: JevQuestionType;
  instructions: unknown;
  criteria?: unknown;
};
export type UpstreamBody = {
  model: string;
  state: unknown;
  questions: Record<string, JevQuestion>;
};

const QUESTION_TYPES: JevQuestionType[] = ["noul", "choice", "score"];
const MAX_QUESTIONS = 10;

/** Validate a caller's Typesafe-shaped body and pin the model. */
export function buildUpstreamBody(input: unknown): UpstreamBody {
  if (!input || typeof input !== "object") throw new Error("Body must be a JSON object with state and questions");
  const raw = input as Record<string, unknown>;
  const state = raw.state;
  if (state === undefined || state === null || state === "") throw new Error("state is required (the text, object, or array to evaluate)");
  const questions = raw.questions;
  if (!questions || typeof questions !== "object" || Array.isArray(questions) || Object.keys(questions).length === 0)
    throw new Error("questions must be a non-empty object of named questions");
  const entries = Object.entries(questions as Record<string, unknown>);
  if (entries.length > MAX_QUESTIONS) throw new Error(`At most ${MAX_QUESTIONS} questions per call`);
  const clean: Record<string, JevQuestion> = {};
  for (const [id, q] of entries) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error(`Question id "${id}" must be 1-64 letters, digits, _ or -`);
    if (!q || typeof q !== "object") throw new Error(`Question "${id}" must be an object`);
    const { type, instructions, criteria } = q as Record<string, unknown>;
    if (!QUESTION_TYPES.includes(type as JevQuestionType)) throw new Error(`Question "${id}": type must be noul, choice, or score`);
    if (instructions === undefined || instructions === null || instructions === "") throw new Error(`Question "${id}": instructions are required`);
    const out: JevQuestion = { type: type as JevQuestionType, instructions };
    if (type === "choice") {
      if (!criteria || typeof criteria !== "object" || Array.isArray(criteria) || Object.keys(criteria).length < 2)
        throw new Error(`Question "${id}": choice needs criteria with at least 2 options`);
      out.criteria = criteria;
    } else if (type === "score") {
      if (!Array.isArray(criteria) || criteria.length < 2) throw new Error(`Question "${id}": score needs criteria with at least 2 ordered levels`);
      out.criteria = criteria;
    } else if (criteria !== undefined) {
      out.criteria = criteria;
    }
    clean[id] = out;
  }
  const body: UpstreamBody = { model: JEV_MODEL, state, questions: clean };
  if (JSON.stringify(body).length > JEV_MAX_BODY_BYTES) throw new Error("Payload must be under 32 KB");
  return body;
}
