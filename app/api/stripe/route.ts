import { stripe } from "@/lib/stripe/stripe";
import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type Stripe from "stripe";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }
  const service = createSupabaseServiceClient();
  const object = event.data.object;
  let args: { p_session: string | null; p_intent: string | null; p_status: string; p_amount?: number | null; p_currency?: string | null };
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded" || event.type === "checkout.session.expired") {
    const session = object as Stripe.Checkout.Session;
    if (session.metadata?.product_type && session.metadata.product_type !== "event") return NextResponse.json({ received: true });
    if (event.type !== "checkout.session.expired" && !["paid", "no_payment_required"].includes(session.payment_status)) return NextResponse.json({ received: true });
    args = { p_session: session.id, p_intent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
      p_status: event.type === "checkout.session.expired" ? "canceled" : "paid", p_amount: session.amount_total, p_currency: session.currency };
  } else if (event.type === "charge.refunded") {
    const charge = object as Stripe.Charge;
    // Partial refunds do not cancel the full ticket entitlement.
    if (!charge.refunded) return NextResponse.json({ received: true });
    args = { p_session: null, p_intent: typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id || null, p_status: "refunded" };
    if (!args.p_intent) return NextResponse.json({ received: true });
  } else return NextResponse.json({ received: true });
  const { error } = await service.rpc("apply_event_checkout", args);
  if (error) return NextResponse.json({ error: "Checkout processing failed; retry required" }, { status: 503 });
  return NextResponse.json({ received: true });
}
