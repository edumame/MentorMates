"use server";

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { headers } from "next/headers";
import { getAppBaseUrl } from "@/lib/utils/app-url";
import { stripe } from "@/lib/stripe/stripe";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import {
  EVENT_CLOSED_FOR_ENROLLMENT_MESSAGE,
  isEventClosedForEnrollment,
} from "@/lib/events/participant-access";

interface CheckoutOptions {
  eventId?: string | null;
  eventSlug?: string | null;
  eventName?: string | null;
  pricingTierId?: string | null; // Required: id from pricing_tiers table
}

export async function fetchClientSecret(options?: CheckoutOptions) {
  // PUB-012: return URLs come from NEXT_PUBLIC_APP_URL, not the Origin header.
  const origin = getAppBaseUrl((await headers()).get("origin"));
  if (!options?.eventId) throw new Error("Event is required for checkout");
  const supabase = await createSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not found");
  }

  // stripe_customer_id is server-managed: read and write it with the service
  // client so a value the user wrote into their own profile is never trusted
  // and the write keeps working once the column is not user-writable (MENT-008).
  const service = createSupabaseServiceClient();
  let { data: userProfile } = await service
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
    const { data: updatedUserProfile, error: userProfileError } = await service
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
    // pricing_tiers stay readable whatever the event's state, so check the event
    // itself with the join rule. RLS hides a taken-down draft from non-members,
    // hence the null case.
    const { data: event } = await supabase
      .from("events")
      .select("visibility, approval_status")
      .eq("event_id", options.eventId)
      .maybeSingle();

    if (!event || isEventClosedForEnrollment(event)) {
      throw new Error(EVENT_CLOSED_FOR_ENROLLMENT_MESSAGE);
    }

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

  const customerId = userProfile?.stripe_customer_id;
  if (!customerId) {
    throw new Error("Failed to load Stripe customer");
  }

  // Create Checkout Sessions from body params.
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    ui_mode: "embedded",
    line_items: lineItems,
    mode: "payment",
    return_url: `${origin}/return?session_id={CHECKOUT_SESSION_ID}${options?.eventSlug ? `&eventSlug=${encodeURIComponent(options.eventSlug)}` : ""}`,
    metadata: { product_type: "event", event_id: options?.eventId || "" },
    // automatic_tax: { enabled: true },
    allow_promotion_codes: true,
  });

  // Persist immutable session mapping without resetting an existing paid entitlement.
  const { error: registrationError } = await service.rpc("register_event_checkout", {
    p_user_id: user.id, p_event_id: options?.eventId, p_pricing_id: options?.pricingTierId,
    p_customer: customerId, p_session: session.id,
  });
  if (registrationError) {
    // Do not leave an untracked payable checkout behind.
    await stripe.checkout.sessions.expire(session.id).catch(() => {});
    throw new Error("Failed to register checkout session");
  }

  if (!session.client_secret) {
    throw new Error("Failed to create checkout session");
  }

  return session.client_secret;
}

export async function fetchGuideClientSecret() {
  // PUB-012: return URLs come from NEXT_PUBLIC_APP_URL, not the Origin header.
  const origin = getAppBaseUrl((await headers()).get("origin"));


  // Best effort: attach customer email if logged in, but do not require auth
  let customerEmail: string | undefined = undefined;
  try {
    const supabase = await createSupabaseClient();
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
  // PUB-012: return URLs come from NEXT_PUBLIC_APP_URL, not the Origin header.
  const origin = getAppBaseUrl((await headers()).get("origin"));


  // Best effort: attach customer email if logged in, but do not require auth
  let customerEmail: string | undefined = undefined;
  try {
    const supabase = await createSupabaseClient();
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
