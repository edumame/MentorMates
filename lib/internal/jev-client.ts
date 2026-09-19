/** Browser-side helper for the Jev playground. Pure functions, no React. */

export type JevKind = "noul" | "choice" | "score";
export type JevQuestionInput = { kind: JevKind; instructions: string; criteria: string };
export type JevQuestion = { type: JevKind; instructions: string; criteria?: Record<string, null> | string[] };
export type JevAsk = { invite: string; apiKey: string; state: string; question: JevQuestion };
export type JevResult = {
  ok: boolean;
  status: number;
  answer?: string;
  error?: string;
  latencyMs: number;
  remaining?: number;
  raw?: unknown;
};

type FetchLike = (url: string, init: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;

const splitList = (text: string) => text.split(",").map((t) => t.trim()).filter(Boolean);

/** Turn the playground's three fields into one Typesafe question. */
export function buildQuestion(input: JevQuestionInput): JevQuestion {
  const instructions = input.instructions.trim();
  if (input.kind === "choice") {
    return { type: "choice", instructions, criteria: Object.fromEntries(splitList(input.criteria).map((o) => [o, null])) };
  }
  if (input.kind === "score") return { type: "score", instructions, criteria: splitList(input.criteria) };
  return { type: "noul", instructions };
}

const pct = (n: unknown) => (typeof n === "number" ? `${Math.round(n * 100)}%` : "");

/** Render the first Typesafe answer as one short line. */
export function extractAnswer(payload: unknown): string {
  const answers = (payload as { answers?: Record<string, Record<string, unknown>> } | null)?.answers;
  const first = answers && Object.values(answers)[0];
  if (!first) return "";
  if (first.type === "noul" && typeof first.noul === "number") return `${first.noul >= 0.5 ? "Yes" : "No"} (${pct(first.noul)})`;
  if (first.type === "choice" && typeof first.choice === "string") {
    const p = (first.probabilities as Record<string, number> | undefined)?.[first.choice];
    return p !== undefined ? `${first.choice} (${pct(p)})` : first.choice;
  }
  if (first.type === "score" && typeof first.score === "number") return String(first.score);
  return "";
}

export function describeError(status: number, body: unknown, retryAfter?: string | null): string {
  const serverMessage = (body as { error?: unknown } | null)?.error;
  const text = typeof serverMessage === "string" ? serverMessage : "";
  if (status === 401) return "That API key was not accepted. Create one under Profile > API Keys on MentorMates and paste it here.";
  if (status === 404) return "This invite link is no longer valid. Ask Chinat for a new one.";
  if (status === 429) return `Rate limit reached (5 calls a minute). Try again in ${retryAfter || "60"} seconds.`;
  if (status === 400 || status === 503) return text || "The request could not be processed.";
  if (status === 502) return "Jev did not answer this time. Try again in a moment.";
  return text || `Unexpected error (${status}).`;
}

export async function askJev(fetchFn: FetchLike, ask: JevAsk): Promise<JevResult> {
  const startedAt = Date.now();
  try {
    const res = await fetchFn(`/api/internal/jev?invite=${encodeURIComponent(ask.invite)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ask.apiKey.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ state: ask.state, questions: { answer: ask.question } }),
    });
    const latencyMs = Date.now() - startedAt;
    const body = await res.json().catch(() => null);
    const remainingHeader = res.headers.get("x-ratelimit-remaining");
    const remaining = remainingHeader === null ? undefined : Number(remainingHeader);
    if (!res.ok) {
      return { ok: false, status: res.status, error: describeError(res.status, body, res.headers.get("retry-after")), latencyMs, remaining, raw: body };
    }
    return { ok: true, status: res.status, answer: extractAnswer(body), latencyMs, remaining, raw: body };
  } catch (e) {
    return { ok: false, status: 0, error: `Network error: ${(e as Error).message}`, latencyMs: Date.now() - startedAt };
  }
}
