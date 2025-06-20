"use server";

import { headers } from "next/headers";

import { stripe } from "@/lib/stripe/stripe";

interface CheckoutOptions {
  eventId?: string | null;
  eventName?: string | null;
  stripePriceId?: string | null;
}

export async function fetchClientSecret(options?: CheckoutOptions) {
  const origin = (await headers()).get("origin");

  let lineItems;

  if (options?.stripePriceId) {
    // Use the specific Stripe price ID for this event
    lineItems = [
      {
        price: options.stripePriceId,
        quantity: 1,
      },
    ];
  } else {
    // Default fallback pricing
    lineItems = [
      {
        price: "price_1Rb7QP3KA04RgYytVnnCAyNn",
        quantity: 1,
      },
    ];
  }

  // Create Checkout Sessions from body params.
  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    line_items: lineItems,
    mode: "payment",
    return_url: `${origin}/return?session_id={CHECKOUT_SESSION_ID}${options?.eventId ? `&eventId=${options.eventId}` : ""}`,
    automatic_tax: { enabled: true },
    allow_promotion_codes: true,
    // Store event metadata for processing after payment
    metadata: {
      ...(options?.eventId && { eventId: options.eventId }),
      ...(options?.eventName && { eventName: options.eventName }),
    },
  });

  if (!session.client_secret) {
    throw new Error("Failed to create checkout session");
  }

  return session.client_secret;
}


export async function fetchPrice(priceId: string | undefined) {
  if (!priceId) {
    return null;
  }
  const price = await stripe.prices.retrieve(priceId);
  return price.unit_amount ? price.unit_amount / 100 : 0;
}