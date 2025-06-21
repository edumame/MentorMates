"use server";

import { headers } from "next/headers";
import { stripe } from "@/lib/stripe/stripe";
import { createSupabaseClient } from "@/app/utils/supabase/server";

interface CheckoutOptions {
  eventId?: string | null;
  eventSlug?: string | null;
  eventName?: string | null;
  stripePriceId?: string | null;
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
    customer: userProfile?.stripe_customer_id,
    ui_mode: "embedded",
    line_items: lineItems,
    mode: "payment",
    return_url: `${origin}/return?session_id={CHECKOUT_SESSION_ID}${options?.eventSlug ? `&eventSlug=${options.eventSlug}` : ""}`,
    // automatic_tax: { enabled: true },
    allow_promotion_codes: true,
  });

  // greedily create a user event payment record for the user in the processing state
  const { data: userEventPayment } = await supabase.from("user_event_payments").upsert({
    user_id: user.id,
    event_id: options?.eventId,
    stripe_customer_id: userProfile?.stripe_customer_id,
    stripe_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent,
    amount_paid: session.amount_total,
    currency: session.currency,
    payment_status: "processing",
  }, {
    onConflict: "user_id,event_id",
  }).select();

  if (!userEventPayment) {
    throw new Error("Failed to create user event payment");
  }

  if (!session.client_secret) {
    throw new Error("Failed to create checkout session");
  }

  return session.client_secret;
}