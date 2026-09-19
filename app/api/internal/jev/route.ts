import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest } from "@/lib/agent/auth";
import { logAgentEvent } from "@/lib/agent/logging";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  JEV_RATE_LIMIT,
  JEV_SERVICE,
  JEV_WINDOW_MS,
  buildUpstreamBody,
  checkInvite,
  decideRateLimit,
  type InviteRow,
} from "@/lib/internal/jev";

/**
 * POST /api/internal/jev
 *
 * Invite-gated, rate-limited proxy to Typesafe's Jev model via OpenRouter.
 * Not discoverable: without a valid invite code the route answers 404.
 *
 *   headers:  x-invite-code: <code>      (or ?invite=<code> in the link we hand out)
 *             Authorization: Bearer mm_sk_…   (any MentorMates agent API key)
 *   body:     { messages: [{ role: "user" | "assistant", content }], response_format?, temperature?, max_tokens? }
 *   limit:    INTERNAL_JEV_RATE_LIMIT calls per minute per key (default 5) → 429 + Retry-After
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UPSTREAM_URL = "https://openrouter.ai/api/v1/chat/completions";
const ROUTE = "/api/internal/jev";

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export async function GET() {
  return notFound();
}

export async function POST(request: NextRequest) {
  const inviteCode =
    request.headers.get("x-invite-code")?.trim() ||
    request.nextUrl.searchParams.get("invite")?.trim() ||
    "";
  if (!inviteCode) return notFound();

  const supabase = createSupabaseServiceClient();

  // 1. Invite first, so an unknown caller only ever sees a 404.
  const { data: inviteData, error: inviteError } = await supabase
    .from("internal_invites")
    .select("id, code, service, revoked_at, expires_at, max_uses, uses")
    .eq("code", inviteCode)
    .maybeSingle();
  if (inviteError) {
    logAgentEvent("internal_invite_lookup_failed", { route: ROUTE }, inviteError);
    return notFound();
  }
  const invite = (inviteData ?? null) as InviteRow | null;
  const inviteCheck = checkInvite(invite, JEV_SERVICE);
  if (!inviteCheck.ok || !invite) return notFound();

  // 2. Then the regular MentorMates agent API key.
  const auth = await authenticateAgentRequest(request, { allowMissingEventId: true });
  if (auth instanceof NextResponse) return auth;

  // 3. Sliding-window rate limit per key, from the usage log.
  const windowStart = new Date(Date.now() - JEV_WINDOW_MS).toISOString();
  const { data: recent, error: usageError } = await supabase
    .from("internal_api_usage")
    .select("created_at")
    .eq("key_id", auth.keyId)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: true })
    .limit(JEV_RATE_LIMIT + 1);
  if (usageError) {
    logAgentEvent("internal_usage_lookup_failed", { route: ROUTE, keyId: auth.keyId }, usageError);
    return NextResponse.json({ error: "Temporarily unavailable" }, { status: 503 });
  }
  const calls = recent ?? [];
  const decision = decideRateLimit(calls.length, {
    oldestInWindow: calls[0] ? new Date(calls[0].created_at) : undefined,
  });
  if (!decision.allowed) {
    return NextResponse.json(
      { error: `Rate limit: ${JEV_RATE_LIMIT} calls per minute per key. Try again shortly.` },
      {
        status: 429,
        headers: {
          "Retry-After": String(decision.retryAfterSeconds ?? 60),
          "X-RateLimit-Limit": String(JEV_RATE_LIMIT),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // 4. Validate the caller's payload and pin the model.
  let upstreamBody;
  try {
    upstreamBody = buildUpstreamBody(await request.json().catch(() => null));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const upstreamKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!upstreamKey) {
    logAgentEvent("internal_jev_not_configured", { route: ROUTE, keyId: auth.keyId }, undefined, "warn");
    return NextResponse.json({ error: "Jev is not configured on this server yet" }, { status: 503 });
  }

  // 5. Forward, log, return.
  const startedAt = Date.now();
  let status = 502;
  let payload: unknown = { error: "Upstream unavailable" };
  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${upstreamKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.mentormates.ai",
        "X-Title": "MentorMates internal Jev proxy",
      },
      body: JSON.stringify(upstreamBody),
    });
    status = upstream.status;
    payload = await upstream.json().catch(() => ({ error: "Upstream returned a non-JSON body" }));
  } catch (e) {
    logAgentEvent("internal_jev_upstream_failed", { route: ROUTE, keyId: auth.keyId }, e);
  }
  const latencyMs = Date.now() - startedAt;
  const usage = (payload as { usage?: { prompt_tokens?: number; completion_tokens?: number } })?.usage;

  const { error: insertError } = await supabase.from("internal_api_usage").insert({
    service: JEV_SERVICE,
    key_id: auth.keyId,
    invite_id: invite.id,
    status,
    latency_ms: latencyMs,
    prompt_tokens: usage?.prompt_tokens ?? null,
    completion_tokens: usage?.completion_tokens ?? null,
  });
  if (insertError) logAgentEvent("internal_usage_insert_failed", { route: ROUTE, keyId: auth.keyId }, insertError);
  void supabase.rpc("increment_internal_invite_uses", { p_invite_id: invite.id });

  const ok = status >= 200 && status < 300;
  return NextResponse.json(ok ? payload : { error: "Upstream error", upstream_status: status, detail: payload }, {
    status: ok ? 200 : 502,
    headers: {
      "X-RateLimit-Limit": String(JEV_RATE_LIMIT),
      "X-RateLimit-Remaining": String(decision.remaining),
    },
  });
}
