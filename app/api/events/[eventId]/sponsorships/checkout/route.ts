import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/stripe";
import { createSupabaseClient } from "@/app/utils/supabase/server";

type TierId = "bronze" | "silver" | "gold";

const TIER_TO_AMOUNT_CENTS: Record<TierId, number> = {
  bronze: 50000,
  silver: 100000,
  gold: 200000,
};

export async function POST(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const { tier } = (await req.json()) as { tier?: TierId };
    if (!tier || !(tier in TIER_TO_AMOUNT_CENTS)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const eventIdentifier = params.eventId;

    // Fetch basic event info for display name (best-effort)
    const supabase = await createSupabaseClient();
    const { data: eventData } = await supabase
      .from("events")
      .select("event_id, event_name, slug")
      .or(`slug.eq.${eventIdentifier},event_id.eq.${eventIdentifier}`)
      .maybeSingle();

    const eventDisplayName = eventData?.event_name || eventIdentifier;
    const eventUrlId = eventData?.slug || eventData?.event_id || eventIdentifier;

    const amountCents = TIER_TO_AMOUNT_CENTS[tier];

    const originHeader = req.headers.get("origin");
    const hostHeader = req.headers.get("host");
    const protocolHeader = req.headers.get("x-forwarded-proto");
    const baseUrl =
      originHeader ||
      (protocolHeader && hostHeader ? `${protocolHeader}://${hostHeader}` : undefined) ||
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
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}

