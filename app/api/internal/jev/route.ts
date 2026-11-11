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
 * Invite-gated, rate-limited proxy to Typesafe's Jev API (/v1/systemone).
 * Not discoverable: without a valid invite code the route answers 404.
 *
 *   headers:  x-invite-code: <code>      (or ?invite=<code> in the link we hand out)
 *             Authorization: Bearer mm_sk_…   (any MentorMates agent API key)
 *   body:     { state, questions: { <id>: { type: noul|choice|score, instructions, criteria? } } }  (model pinned server-side)
 *   limit:    INTERNAL_JEV_RATE_LIMIT calls per minute per key (default 5) → 429 + Retry-After
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UPSTREAM_URL = "https://api.typesafe.ai/v1/systemone";
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

  // 3. Validate the caller's payload and pin the model. This runs before the
  // reservation so a call that is never forwarded does not use up a slot.
  let upstreamBody;
  try {
    upstreamBody = buildUpstreamBody(await request.json().catch(() => null));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const upstreamKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!upstreamKey) {
    logAgentEvent("internal_jev_not_configured", { route: ROUTE, keyId: auth.keyId }, undefined, "warn");
    return NextResponse.json({ error: "Jev is not configured on this server yet" }, { status: 503 });
  }

  // 4. Atomically reserve a sliding-window slot and an invite use before
  // forwarding, so calls still in flight count against the limit.
  const { data: reservations, error: reserveError } = await supabase.rpc("reserve_internal_api_call", {
    p_service: JEV_SERVICE,
    p_key_id: auth.keyId,
    p_invite_id: invite.id,
    p_limit: JEV_RATE_LIMIT,
    p_window_seconds: JEV_WINDOW_MS / 1000,
  });
  const reservation = reservations?.[0];
  if (reserveError || !reservation) {
    logAgentEvent("internal_usage_reserve_failed", { route: ROUTE, keyId: auth.keyId }, reserveError ?? undefined);
    return NextResponse.json({ error: "Temporarily unavailable" }, { status: 503 });
  }
  if (reservation.outcome === "invite_unavailable") return notFound();
  const decision = decideRateLimit(reservation.calls_in_window, {
    oldestInWindow: reservation.oldest_in_window ? new Date(reservation.oldest_in_window) : undefined,
  });
  const usageId = reservation.usage_id;
  if (usageId === null) {
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

  // 5. Forward, complete the usage row, return.
  const startedAt = Date.now();
  let status = 502;
  let payload: unknown = { error: "Upstream unavailable" };
  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${upstreamKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(upstreamBody),
    });
    status = upstream.status;
    payload = await upstream.json().catch(() => ({ error: "Upstream returned a non-JSON body" }));
  } catch (e) {
    logAgentEvent("internal_jev_upstream_failed", { route: ROUTE, keyId: auth.keyId }, e);
  }
  const latencyMs = Date.now() - startedAt;
  const usage = (payload as { usage?: { input_tokens?: number; output_tokens?: number } })?.usage;

  const { error: updateError } = await supabase
    .from("internal_api_usage")
    .update({
      status,
      latency_ms: latencyMs,
      prompt_tokens: usage?.input_tokens ?? null,
      completion_tokens: usage?.output_tokens ?? null,
    })
    .eq("id", usageId);
  if (updateError) logAgentEvent("internal_usage_update_failed", { route: ROUTE, keyId: auth.keyId }, updateError);

  const ok = status >= 200 && status < 300;
  return NextResponse.json(ok ? payload : { error: "Upstream error", upstream_status: status, detail: payload }, {
    status: ok ? 200 : 502,
    headers: {
      "X-RateLimit-Limit": String(JEV_RATE_LIMIT),
      "X-RateLimit-Remaining": String(decision.remaining),
    },
  });
}
