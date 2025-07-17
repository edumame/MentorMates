import { stripe } from "@/lib/stripe/stripe";
import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import {
  STRIPE_FAILED_EVENT_TYPES,
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
    !STRIPE_FAILED_EVENT_TYPES.includes(event.type)
  ) {
    return;
  }

  // only check checkoutsession status for now; too many complicated things to check for other events
  const stripeCustomerId = event.data.object as { customer: string };
  const stripeCheckoutSessionId = event.data.object as { id: string };
  const stripeAmountTotal = event.data.object as { amount_total: number };

  if (STRIPE_SUCCESSFUL_EVENT_TYPES.includes(event.type)) {
    const { data: userEventPayment } = await supabase
      .from("user_event_payments")
      .update({
        payment_status: "paid",
        amount_paid: stripeAmountTotal.amount_total,
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
  }
}
