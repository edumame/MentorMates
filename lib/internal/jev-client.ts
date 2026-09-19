/** Browser-side helper for the Jev playground. Pure functions, no React. */

export type JevAsk = { invite: string; apiKey: string; question: string };
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

export function extractAnswer(payload: unknown): string {
  const content = (payload as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
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
      body: JSON.stringify({ messages: [{ role: "user", content: ask.question }] }),
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
