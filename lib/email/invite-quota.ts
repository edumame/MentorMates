import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reserves one invitation email against the inviter's and the event's daily
 * quota (public.consume_invite_quota; 50 per inviter and 100 per event per 24h).
 * Returns a 429/500 response to send back, or null when the send may proceed.
 */
export async function reserveInviteQuota(
  service: SupabaseClient,
  inviterId: string,
  eventId: string
): Promise<NextResponse | null> {
  const { data, error } = await service.rpc("consume_invite_quota", {
    p_inviter_id: inviterId,
    p_event_id: eventId,
  });
  const verdict = Array.isArray(data) ? data[0] : data;
  if (error || !verdict) {
    console.error("Failed to reserve invite quota:", error?.code);
    return NextResponse.json({ error: "Failed to send invitation" }, { status: 500 });
  }
  if (!verdict.allowed) {
    const retryAt = verdict.retry_at ? new Date(verdict.retry_at).getTime() : Date.now() + 3600_000;
    const retryAfterSeconds = Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
    return NextResponse.json(
      {
        error:
          verdict.scope === "event"
            ? "This event has reached its daily invitation limit. Try again later."
            : "You have reached your daily invitation limit. Try again later.",
        retry_after_seconds: retryAfterSeconds,
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }
  return null;
}
