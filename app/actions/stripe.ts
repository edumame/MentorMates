"use server";

import { headers } from "next/headers";
import { stripe } from "@/lib/stripe/stripe";
import { createSupabaseServiceClient } from "@/app/utils/supabase/server";
import Stripe from "stripe";

interface CheckoutOptions {
  eventId?: string | null;
  eventSlug?: string | null;
  eventName?: string | null;
  pricingTierId?: string | null; // Required: id from pricing_tiers table
}

export async function fetchClientSecret(options?: CheckoutOptions) {
  const origin = (await headers()).get("origin");
  const supabase = await createSupabaseServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not found");
  }

  let { data: userProfile } = await supabase
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("uid", user.id)
    .maybeSingle();

  if (!userProfile?.stripe_customer_id) {
    const customer = await stripe.customers.create({
      metadata: {
        userId: user.id,
      },
    });

    // Update the stripe_customer_id and get the updated record
    const { data: updatedUserProfile, error: userProfileError } = await supabase
      .from("user_profiles")
      .update({
        stripe_customer_id: customer.id,
      })
      .eq("uid", user.id)
      .select("stripe_customer_id")
      .single();

    if (userProfileError) {
      throw new Error("Failed to update user profile with Stripe customer ID");
    }

    // Update the userProfile variable with the updated data
    userProfile = updatedUserProfile;
  }

  let lineItems;

  if (options?.pricingTierId) {
    // Query the pricing_tiers table for the specific tier
    const { data: pricingTierData } = await supabase
      .from("pricing_tiers")
      .select(
        `*`
      )
      .eq("event_id", options.eventId)
      .eq("id", options.pricingTierId)
      .eq("is_active", true)
      .single();
    
    if (pricingTierData) {
      // Check if tier is still available
      if (pricingTierData.available_until) {
        const availableUntil = new Date(pricingTierData.available_until);
        if (availableUntil < new Date()) {
          throw new Error("Selected pricing tier is no longer available.");
        }
      }
      
      // Check if tier has reached max quantity
      if (pricingTierData.max_quantity && pricingTierData.current_quantity >= pricingTierData.max_quantity) {
        throw new Error("Selected pricing tier is sold out.");
      }
      
      if (pricingTierData.stripe_price_id) {
        lineItems = [
          {
            price: pricingTierData.stripe_price_id,
            quantity: 1,
          },
        ];
      } else {
        throw new Error("Selected pricing tier does not have a Stripe price ID configured.");
      }
    } else {
      throw new Error("Selected pricing tier not found or inactive.");
    }
  } else {
    throw new Error("No pricing tier selected. Please select a pricing tier to continue.");
  }

  // Create Checkout Sessions from body params.
  const session = await stripe.checkout.sessions.create({
    customer: userProfile?.stripe_customer_id,
    ui_mode: "embedded",
    line_items: lineItems,
    mode: "payment",
    return_url: `${origin}/return?session_id={CHECKOUT_SESSION_ID}${options?.eventSlug ? `&eventSlug=${options.eventSlug}` : ""}`,
    // automatic_tax: { enabled: true },
    allow_promotion_codes: true,
  });

  // greedily create a user event payment record for the user in the processing state
  const { data: userEventPayment } = await supabase
    .from("user_event_payments")
    .upsert(
      {
        user_id: user.id,
        event_id: options?.eventId,
        stripe_customer_id: userProfile?.stripe_customer_id,
        stripe_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent,
        amount_paid: session.amount_total,
        currency: session.currency,
        payment_status: "processing",
        pricing_id: options?.pricingTierId,
      },
      {
        onConflict: "user_id,event_id",
      }
    )
    .select();

  if (!userEventPayment) {
    throw new Error("Failed to create user event payment");
  }

  if (!session.client_secret) {
    throw new Error("Failed to create checkout session");
  }

  return session.client_secret;
}

export async function fetchGuideClientSecret() {
  const origin = (await headers()).get("origin");

  if (!origin) {
    throw new Error("Missing origin header");
  }

  // Best effort: attach customer email if logged in, but do not require auth
  let customerEmail: string | undefined = undefined;
  try {
    const supabase = await createSupabaseServiceClient();
    const { data } = await supabase.auth.getUser();
    customerEmail = data.user?.email ?? undefined;
  } catch {
    // ignore auth errors; allow guest checkout
  }

  type SimpleLineItem = { price: string; quantity: number };
  type InlinePriceLineItem = {
    price_data: {
      currency: string;
      unit_amount: number;
      product_data: { name: string };
    };
    quantity: number;
  };
  const lineItems: Array<SimpleLineItem | InlinePriceLineItem> = [];

  // Prefer a pre-configured Stripe Price if provided via env
  const guidePriceId = process.env.GUIDE_STRIPE_PRICE_ID;
  if (guidePriceId) {
    lineItems.push({ price: guidePriceId, quantity: 1 });
  } else {
    // Fallback: inline price data for $20 USD
    lineItems.push({
      price_data: {
        currency: "usd",
        unit_amount: 2000,
        product_data: {
          name: "2025 Ultimate AI Vibe Coding Guide - Instant Access",
        },
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    mode: "payment",
    line_items: lineItems,
    return_url: `${origin}/ai-vibe-guide/return?session_id={CHECKOUT_SESSION_ID}`,
    allow_promotion_codes: true,
    metadata: {
      product: "ai-vibe-2025",
      product_type: "digital_guide",
    },
    ...(customerEmail ? { customer_email: customerEmail } : {}),
  });

  if (!session.client_secret) {
    throw new Error("Failed to create checkout session");
  }

  return session.client_secret;
}

export async function fetchMasterclassClientSecret() {
  const origin = (await headers()).get("origin");

  if (!origin) {
    throw new Error("Missing origin header");
  }

  // Best effort: attach customer email if logged in, but do not require auth
  let customerEmail: string | undefined = undefined;
  try {
    const supabase = await createSupabaseServiceClient();
    const { data } = await supabase.auth.getUser();
    customerEmail = data.user?.email ?? undefined;
  } catch {
    // ignore auth errors; allow guest checkout
  }

  type SimpleLineItem = { price: string; quantity: number };
  type InlinePriceLineItem = {
    price_data: {
      currency: string;
      unit_amount: number;
      product_data: { name: string };
    };
    quantity: number;
  };
  const lineItems: Array<SimpleLineItem | InlinePriceLineItem> = [];

  const masterclassPriceId = process.env.MASTERCLASS_STRIPE_PRICE_ID;
  if (masterclassPriceId) {
    lineItems.push({ price: masterclassPriceId, quantity: 1 });
  } else {
    // Fallback: inline price data for $2,500 USD
    lineItems.push({
      price_data: {
        currency: "usd",
        unit_amount: 250000,
        product_data: {
          name: "AI Vibe Coding Masterclass - 3 Week Program",
        },
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    mode: "payment",
    line_items: lineItems,
    return_url: `${origin}/ai-vibe-masterclass`,
    allow_promotion_codes: true,
    metadata: {
      product: "ai-vibe-masterclass",
      product_type: "course",
    },
    ...(customerEmail ? { customer_email: customerEmail } : {}),
  });

  if (!session.client_secret) {
    throw new Error("Failed to create checkout session");
  }

  return session.client_secret;
}
