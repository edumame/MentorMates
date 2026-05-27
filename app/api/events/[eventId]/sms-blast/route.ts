import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { canAccessRole } from "@/features/user/roles/roles";
import { EventRole } from "@/lib/types";
import { sendSms } from "@/lib/twilio";

const BLAST_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_MESSAGE_LENGTH = 320; // ~2 SMS segments

const BodySchema = z.object({
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
});

// GET returns the current rate-limit + recipient count so the UI can render state.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const supabase = await createSupabaseClient();
  const { eventId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authz = await assertOrganizer(supabase, eventId, user.id);
  if (authz) return authz;

  const service = createSupabaseServiceClient();
  const status = await getBlastStatus(service, eventId);
  return NextResponse.json(status);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const supabase = await createSupabaseClient();
  const { eventId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authz = await assertOrganizer(supabase, eventId, user.id);
  if (authz) return authz;

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.errors },
      { status: 400 }
    );
  }

  const service = createSupabaseServiceClient();

  const { data: lastBlast } = await service
    .from("sms_blasts")
    .select("created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastBlast?.created_at) {
    const elapsed = Date.now() - new Date(lastBlast.created_at).getTime();
    if (elapsed < BLAST_COOLDOWN_MS) {
      const retry_after_ms = BLAST_COOLDOWN_MS - elapsed;
      return NextResponse.json(
        {
          error: "Rate limit: SMS blast can only be sent once every 6 hours.",
          retry_after_ms,
          next_available_at: new Date(Date.now() + retry_after_ms).toISOString(),
        },
        { status: 429 }
      );
    }
  }

  // Recipients: anyone registered for this event (any role) with a verified phone.
  const { data: recipients, error: rcptError } = await service
    .from("user_event_roles")
    .select("user_id, user_phone_numbers!inner(phone_number, verification_status)")
    .eq("event_id", eventId)
    .eq("user_phone_numbers.verification_status", "verified");

  if (rcptError) {
    console.error("sms-blast recipients query failed", rcptError);
    return NextResponse.json(
      { error: "Failed to load recipients" },
      { status: 500 }
    );
  }

  // Dedupe by phone number (a user with multiple verified numbers → first wins).
  const phones = new Set<string>();
  for (const row of recipients ?? []) {
    const numbers = row.user_phone_numbers as unknown as
      | { phone_number: string }[]
      | { phone_number: string }
      | null;
    if (!numbers) continue;
    const list = Array.isArray(numbers) ? numbers : [numbers];
    for (const n of list) {
      if (n?.phone_number) phones.add(n.phone_number);
    }
  }

  if (phones.size === 0) {
    return NextResponse.json(
      { error: "No event participants have verified phone numbers" },
      { status: 400 }
    );
  }

  // Send sequentially with per-message error capture so a few failures don't kill the batch.
  let sent = 0;
  const failures: { phone: string; error: string }[] = [];
  for (const phone of phones) {
    try {
      await sendSms(phone, parsed.data.message);
      sent += 1;
    } catch (err) {
      failures.push({
        phone,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  await service.from("sms_blasts").insert({
    event_id: eventId,
    sent_by: user.id,
    message: parsed.data.message,
    recipient_count: sent,
  });

  return NextResponse.json({
    ok: true,
    attempted: phones.size,
    sent,
    failed: failures.length,
    failures: failures.slice(0, 10),
    next_available_at: new Date(Date.now() + BLAST_COOLDOWN_MS).toISOString(),
  });
}

async function assertOrganizer(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  eventId: string,
  userId: string
): Promise<NextResponse | null> {
  const { data: roleRow } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: isAdminRpc } = await supabase.rpc("is_admin_user", {
    user_id: userId,
  });

  const isOrganizer =
    roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Organizer);

  if (!isOrganizer && !isAdminRpc) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

async function getBlastStatus(
  service: ReturnType<typeof createSupabaseServiceClient>,
  eventId: string
) {
  const { data: lastBlast } = await service
    .from("sms_blasts")
    .select("created_at, recipient_count, sent_by")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: recipientCount } = await service
    .from("user_event_roles")
    .select("user_id, user_phone_numbers!inner(phone_number, verification_status)", {
      count: "exact",
      head: true,
    })
    .eq("event_id", eventId)
    .eq("user_phone_numbers.verification_status", "verified");

  const now = Date.now();
  const lastAt = lastBlast?.created_at
    ? new Date(lastBlast.created_at).getTime()
    : 0;
  const elapsed = lastAt ? now - lastAt : Infinity;
  const can_send = elapsed >= BLAST_COOLDOWN_MS;
  const next_available_at = can_send
    ? null
    : new Date(lastAt + BLAST_COOLDOWN_MS).toISOString();

  return {
    can_send,
    next_available_at,
    cooldown_ms: BLAST_COOLDOWN_MS,
    last_blast: lastBlast ?? null,
    recipient_count: recipientCount ?? 0,
  };
}
