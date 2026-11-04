import { stripe } from "@/lib/stripe/stripe";
import { NextResponse } from "next/server";
// import { createSupabaseClient } from "@/app/utils/supabase/server";
//need to allow stripe to access the database as a service account
import { createSupabaseServiceClient } from "@/app/utils/supabase/server";
import {
  STRIPE_FAILED_EVENT_TYPES,
  STRIPE_REFUNDED_EVENT_TYPES,
  STRIPE_SUCCESSFUL_EVENT_TYPES,
} from "@/lib/config/constants";
import type { Database } from "@/lib/database.types";
import Stripe from "stripe";

type FulfilledCheckoutPayment =
  Database["public"]["Functions"]["fulfill_checkout_session"]["Returns"][number];

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing Stripe signature", { status: 400 });
  }

  async function doEventHandling() {
    if (typeof signature !== "string") {
      throw new Error("Invalid Stripe signature");
    }

    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("Stripe not configured");
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    await handleEvent(event);
  }

  try {
    await doEventHandling();
  } catch (error) {
    console.error("Stripe processing error: ", error);
    throw new Error(`Stripe processing error. Please contact support.`);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleEvent(event: Stripe.Event) {
  const supabase = await createSupabaseServiceClient();
  if (
    !STRIPE_SUCCESSFUL_EVENT_TYPES.includes(event.type) &&
    !STRIPE_FAILED_EVENT_TYPES.includes(event.type) &&
    !STRIPE_REFUNDED_EVENT_TYPES.includes(event.type)
  ) {
    return;
  }

  // only check checkoutsession status for now; too many complicated things to check for other events
  const stripeCustomerId = event.data.object as { customer: string };
  const stripeCheckoutSessionId = event.data.object as { id: string };
  const stripeAmountTotal = event.data.object as { amount_total: number };
  const stripePaymentIntentId = event.data.object as { payment_intent: string };

  if (STRIPE_SUCCESSFUL_EVENT_TYPES.includes(event.type)) {
    // Stripe delivers at least once, so this must be safe to repeat. The function
    // marks the payment paid, issues its tickets and assigns the buyer's in one
    // transaction, so there is no later step for a killed delivery to skip.
    const { data: userEventPayment } = await supabase
      .rpc("fulfill_checkout_session", {
        p_stripe_customer_id: stripeCustomerId.customer,
        p_stripe_session_id: stripeCheckoutSessionId.id,
        p_amount_paid: stripeAmountTotal.amount_total,
        p_stripe_payment_intent_id: stripePaymentIntentId.payment_intent,
      })
      .maybeSingle<FulfilledCheckoutPayment>();

    if (!userEventPayment) {
      throw new Error("Failed to update user event payment");
    }
  } else if (STRIPE_FAILED_EVENT_TYPES.includes(event.type)) {
    const { data: userEventPayment } = await supabase
      .from("user_event_payments")
      .update({
        payment_status: "canceled",
      })
      .eq("stripe_customer_id", stripeCustomerId.customer)
      .eq("stripe_session_id", stripeCheckoutSessionId.id)
      .select("id");

    if (!userEventPayment) {
      throw new Error("Failed to update user event payment");
    }
  } else if (STRIPE_REFUNDED_EVENT_TYPES.includes(event.type)) {
    const { data: userEventPayment } = await supabase
      .from("user_event_payments")
      .update({
        payment_status: "refunded",
      })
      .eq("stripe_payment_intent_id", stripePaymentIntentId.payment_intent)
      .select("id, event_id, user_id")
      .single();

    if (!userEventPayment) {
      throw new Error("Failed to update user event payment");
    }

    const { data: userEventRoles } = await supabase
      .from("user_event_roles")
      .delete()
      .eq("event_id", userEventPayment.event_id)
      .eq("user_id", userEventPayment.user_id)
      .select("id");

    if (!userEventRoles) {
      throw new Error("Failed to delete user event roles");
    }

    //delete the tickets
    const { data: tickets } = await supabase
      .from("event_tickets")
      .delete()
      .eq("payment_id", userEventPayment.id)
      .select("id");

    if (!tickets) {
      throw new Error("Failed to delete tickets");
    }
  }
}
