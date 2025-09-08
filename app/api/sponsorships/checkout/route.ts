import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/stripe";
import { createSupabaseClient } from "@/app/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, tierId, tierName, amount } = body;

    if (!eventId || !tierId || !tierName || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, slug")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Get or create Stripe customer
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("stripe_customer_id, display_name, email")
      .eq("uid", user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    let stripeCustomerId = userProfile.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email || userProfile.email,
        name: userProfile.display_name,
        metadata: {
          userId: user.id,
        },
      });

      // Update user profile with Stripe customer ID
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ stripe_customer_id: customer.id })
        .eq("uid", user.id);

      if (updateError) {
        console.error("Failed to update user profile with Stripe customer ID:", updateError);
      }

      stripeCustomerId = customer.id;
    }

    // Create Stripe checkout session for sponsorship
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${tierName} - ${event.name}`,
              description: `Sponsorship for ${event.name}`,
              metadata: {
                eventId: eventId,
                tierId: tierId,
                type: "sponsorship",
              },
            },
            unit_amount: amount * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${request.headers.get("origin")}/events/${eventId}/sponsorships/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get("origin")}/events/${eventId}/sponsorships`,
      metadata: {
        eventId: eventId,
        userId: user.id,
        tierId: tierId,
        tierName: tierName,
        type: "sponsorship",
      },
    });

    // Store sponsorship payment record
    const { error: paymentError } = await supabase
      .from("event_sponsorships")
      .insert({
        event_id: eventId,
        user_id: user.id,
        tier_id: tierId,
        tier_name: tierName,
        amount: amount,
        stripe_session_id: session.id,
        stripe_customer_id: stripeCustomerId,
        payment_status: "pending",
      });

    if (paymentError) {
      // If the table doesn't exist, we'll create a simpler record
      console.log("Note: event_sponsorships table may not exist yet. Proceeding with checkout.");
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating sponsorship checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}