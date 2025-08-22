"use server";

import { headers } from "next/headers";
import { stripe } from "@/lib/stripe/stripe";
import { createSupabaseClient } from "@/app/utils/supabase/server";

interface CheckoutOptions {
  eventId?: string | null;
  eventSlug?: string | null;
  eventName?: string | null;
  pricingId?: string | null; // Required: id from pricing_tiers table
}

export async function fetchClientSecret(options?: CheckoutOptions) {
  const origin = (await headers()).get("origin");
  const supabase = await createSupabaseClient();
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

  if (options?.pricingId) {
    // Query the pricing_tiers table for the specific tier
    const { data: pricingTierData } = await supabase
      .from("pricing_tiers")
      .select(
        `*`
      )
      .eq("event_id", options.eventId)
      .eq("id", options.pricingId)
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
