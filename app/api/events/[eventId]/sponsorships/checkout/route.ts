import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/stripe";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { isUnreviewedApprovalStatus } from "@/lib/events/approval";
import { getAppBaseUrl } from "@/lib/utils/app-url";

type TierId = "bronze" | "silver" | "gold";

const DEFAULT_TIER_TO_AMOUNT_CENTS: Record<TierId, number> = {
  bronze: 50000,
  silver: 100000,
  gold: 200000,
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
// Sponsorship checkout is only offered for live events. Drafts, archived
// events and listings still in (or refused by) admin review get a 404.
const LIVE_VISIBILITIES = new Set(["public", "private"]);

function isTierId(value: unknown): value is TierId {
  return typeof value === "string" && value in DEFAULT_TIER_TO_AMOUNT_CENTS;
}

type SponsorshipEvent = {
  event_id: string;
  event_name: string;
  slug: string | null;
  visibility: string;
  approval_status: string | null;
  sponsorship_tiers: unknown;
};

/**
 * Resolve the event for a sponsorship checkout (PUB-019). The identifier is
 * validated (UUID or slug) and looked up with separate eq() filters; the raw
 * path segment is never used as a display name or URL.
 */
async function findSponsorableEvent(identifier: string): Promise<SponsorshipEvent | null> {
  const id = identifier.trim();
  const isUuid = isValidUUID(id);
  if (!isUuid && !SLUG_PATTERN.test(id)) return null;

  const supabase = await createSupabaseClient();
  const columns = "event_id, event_name, slug, visibility, approval_status, sponsorship_tiers";

  let event: SponsorshipEvent | null = null;
  if (isUuid) {
    const { data } = await supabase.from("events").select(columns).eq("event_id", id).maybeSingle();
    event = (data as SponsorshipEvent | null) ?? null;
  }
  if (!event) {
    const { data } = await supabase.from("events").select(columns).eq("slug", id).maybeSingle();
    event = (data as SponsorshipEvent | null) ?? null;
  }

  if (!event) return null;
  if (!LIVE_VISIBILITIES.has(event.visibility)) return null;
  if (isUnreviewedApprovalStatus(event.approval_status)) return null;
  return event;
}

function getTierAmountCents(event: SponsorshipEvent, tier: TierId) {
  const tiers = (event.sponsorship_tiers as { tiers?: unknown } | null)?.tiers;
  if (Array.isArray(tiers)) {
    const matched = (tiers as { id?: string; label?: string; price?: unknown }[]).find(
      (t) => String(t.id || t.label || "").toLowerCase() === tier
    );
    if (matched && typeof matched.price === "number" && Number.isInteger(matched.price) && matched.price > 0) {
      return matched.price;
    }
  }
  return DEFAULT_TIER_TO_AMOUNT_CENTS[tier];
}


type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

async function createSponsorshipCheckout(
  request: NextRequest,
  eventIdentifier: string,
  tier: unknown
): Promise<CheckoutResult> {
  if (!isTierId(tier)) return { ok: false, status: 400, error: "Invalid tier" };

  const event = await findSponsorableEvent(eventIdentifier);
  if (!event) return { ok: false, status: 404, error: "Event not found" };

  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, status: 503, error: "Sponsorship payments are temporarily unavailable" };
  }

  // Never derive redirect targets from caller-supplied Origin/Host headers.
  const baseUrl = getAppBaseUrl(request.nextUrl.origin);
  const eventUrlId = encodeURIComponent(event.slug || event.event_id);
  const tierLabel = `${tier.charAt(0).toUpperCase()}${tier.slice(1)}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: getTierAmountCents(event, tier),
          product_data: { name: `${event.event_name} Sponsorship - ${tierLabel}` },
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/events/${eventUrlId}/sponsorships?success=true`,
    cancel_url: `${baseUrl}/events/${eventUrlId}/sponsorships?canceled=true`,
    metadata: {
      event_id: event.event_id,
      event_slug: event.slug || "",
      tier,
      type: "event_sponsorship",
    },
  });

  if (!session.url) return { ok: false, status: 500, error: "Failed to create checkout" };
  return { ok: true, url: session.url };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const body = (await request.json().catch(() => null)) as { tier?: unknown } | null;
    const { eventId } = await params;
    const result = await createSponsorshipCheckout(request, eventId, body?.tier);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ url: result.url }, { status: 200 });
  } catch (error) {
    console.error("Failed to create sponsorship checkout session:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const tier = new URL(request.url).searchParams.get("tier");
    const result = await createSponsorshipCheckout(request, eventId, tier);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.redirect(result.url, 303);
  } catch (error) {
    console.error("Failed to create sponsorship checkout session (GET):", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
