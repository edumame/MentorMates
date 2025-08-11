import { stripe } from "@/lib/stripe/stripe";
import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import {
  STRIPE_FAILED_EVENT_TYPES,
  STRIPE_REFUNDED_EVENT_TYPES,
  STRIPE_SUCCESSFUL_EVENT_TYPES,
} from "@/lib/config/constants";
import Stripe from "stripe";

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
  
  const supabase = await createSupabaseClient();
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
    const { data: userEventPayment } = await supabase
      .from("user_event_payments")
      .update({
        payment_status: "paid",
        amount_paid: stripeAmountTotal.amount_total,
        stripe_payment_intent_id: stripePaymentIntentId.payment_intent,
      })
      .eq("stripe_customer_id", stripeCustomerId.customer)
      .eq("stripe_session_id", stripeCheckoutSessionId.id)
      .select("id");

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
      console.log("REFUNDED EVENT TYPE", event.type);
    // check if the payment intent is in refund list; if it is, set the payment status to refunded
      console.log("REFUNDED", event)
      console.log(stripePaymentIntentId.payment_intent);
      const { data: userEventPayment } = await supabase
        .from("user_event_payments")
        .update({
          payment_status: "refunded",
        })
        .eq("stripe_payment_intent_id", stripePaymentIntentId.payment_intent)
        .select("id, event_id, user_id")
        .single();

      console.log("USER EVENT PAYMENT", userEventPayment);

      if (!userEventPayment) {
        throw new Error("Failed to update user event payment");
      }

      // delete the user event roles if refunded
      const { data: userEventRoles } = await supabase
        .from("user_event_roles")
        .delete()
        .eq("event_id", userEventPayment.event_id)
        .eq("user_id", userEventPayment.user_id)
        .select("id");

      if (!userEventRoles) {
        throw new Error("Failed to delete user event roles");
      }
  }
}
