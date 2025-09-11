import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/stripe";
import { createSupabaseClient } from "@/app/utils/supabase/server";

type TierId = "bronze" | "silver" | "gold";

const DEFAULT_TIER_TO_AMOUNT_CENTS: Record<TierId, number> = {
  bronze: 50000,
  silver: 100000,
  gold: 200000,
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 500 }
      );
    }

    const { tier } = (await _request.json()) as { tier?: TierId };
    if (!tier || !(tier in DEFAULT_TIER_TO_AMOUNT_CENTS)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const { eventId: eventIdentifier } = await params;

    // Fetch basic event info for display name (best-effort)
    const supabase = await createSupabaseClient();
    const { data: eventData } = await supabase
      .from("events")
      .select("event_id, event_name, slug, sponsorship_tiers")
      .or(`slug.eq.${eventIdentifier},event_id.eq.${eventIdentifier}`)
      .maybeSingle();

    const eventDisplayName = eventData?.event_name || eventIdentifier;
    const eventUrlId =
      eventData?.slug || eventData?.event_id || eventIdentifier;

    let amountCents = DEFAULT_TIER_TO_AMOUNT_CENTS[tier];
    if (
      eventData?.sponsorship_tiers?.tiers &&
      Array.isArray(eventData.sponsorship_tiers.tiers)
    ) {
      const matched = (
        eventData.sponsorship_tiers.tiers as unknown as {
          id: string;
          label: string;
          price: number;
        }[]
      ).find((t) => {
        const id = String(t.id || t.label || "").toLowerCase();
        return id === tier;
      });
      if (matched && typeof matched.price === "number") {
        amountCents = matched.price;
      }
    }

    const originHeader = _request.headers.get("origin");
    const hostHeader = _request.headers.get("host");
    const protocolHeader = _request.headers.get("x-forwarded-proto");
    const baseUrl =
      originHeader ||
      (protocolHeader && hostHeader
        ? `${protocolHeader}://${hostHeader}`
        : undefined) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `${eventDisplayName} Sponsorship - ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/events/${encodeURIComponent(eventUrlId)}/sponsorships?success=true`,
      cancel_url: `${baseUrl}/events/${encodeURIComponent(eventUrlId)}/sponsorships?canceled=true`,
      metadata: {
        event_id: eventData?.event_id || "",
        event_slug: eventData?.slug || "",
        tier,
        type: "event_sponsorship",
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error("Failed to create sponsorship checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const tierParam = url.searchParams.get("tier") as TierId | null;
    if (!tierParam || !(tierParam in DEFAULT_TIER_TO_AMOUNT_CENTS)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const { eventId: eventIdentifier } = await params;

    const supabase = await createSupabaseClient();
    const { data: eventData } = await supabase
      .from("events")
      .select("event_id, event_name, slug, sponsorship_tiers")
      .or(`slug.eq.${eventIdentifier},event_id.eq.${eventIdentifier}`)
      .maybeSingle();

    const eventDisplayName = eventData?.event_name || eventIdentifier;
    const eventUrlId =
      eventData?.slug || eventData?.event_id || eventIdentifier;

    let amountCents = DEFAULT_TIER_TO_AMOUNT_CENTS[tierParam];
    if (
      eventData?.sponsorship_tiers?.tiers &&
      Array.isArray(eventData.sponsorship_tiers.tiers)
    ) {
      const matched = (
        eventData.sponsorship_tiers.tiers as unknown as {
          id: string;
          label: string;
          price: number;
        }[]
      ).find((t) => {
        const id = String(t.id || t.label || "").toLowerCase();
        return id === tierParam;
      });
      if (matched && typeof matched.price === "number") {
        amountCents = matched.price;
      }
    }

    const originHeader = request.headers.get("origin");
    const hostHeader = request.headers.get("host");
    const protocolHeader = request.headers.get("x-forwarded-proto");
    const baseUrl =
      originHeader ||
      (protocolHeader && hostHeader
        ? `${protocolHeader}://${hostHeader}`
        : undefined) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `${eventDisplayName} Sponsorship - ${tierParam.charAt(0).toUpperCase()}${tierParam.slice(1)}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/events/${encodeURIComponent(eventUrlId)}/sponsorships?success=true`,
      cancel_url: `${baseUrl}/events/${encodeURIComponent(eventUrlId)}/sponsorships?canceled=true`,
      metadata: {
        event_id: eventData?.event_id || "",
        event_slug: eventData?.slug || "",
        tier: tierParam,
        type: "event_sponsorship",
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    console.error(
      "Failed to create sponsorship checkout session (GET):",
      error
    );
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 }
    );
  }
}
