import { stripe } from "@/lib/stripe/stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing Stripe signature", { status: 400 });
  }

  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );

  if (!event) {
    return new Response("Invalid Stripe event", { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    console.log("Payment intent succeeded");
  }

  return NextResponse.json({ received: true }, { status: 200 });

}