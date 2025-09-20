import { stripe } from "@/lib/stripe/stripe";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { NextResponse } from "next/server";
import { canAccessRole } from "@/features/user/roles/roles";
import { EventRole } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json(
        { error: "eventId parameter is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseClient();

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin or has access to this event
    const { data: isAdmin } = await supabase.rpc("is_admin_user", {
      user_id: user.user.id,
    });

    if (!isAdmin) {
      // Check if user has role in this event
      const { data: userRole } = await supabase
        .from("user_event_roles")
        .select("role")
        .eq("user_id", user.user.id)
        .eq("event_id", eventId)
        .single();

      if (
        !userRole ||
        !canAccessRole(userRole.role as EventRole, EventRole.Organizer)
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { data: coupons, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("event_id", eventId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ coupons });
    }
  } catch (error) {
    console.error("Error fetching coupons:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching coupons" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const {
      couponName,
      eventId,
      percent_off,
      amount_off,
      currency,
      duration,
      max_redemptions,
      redeem_by,
      codes,
    } = await req.json();

    // Validate required fields
    if (!couponName || !eventId || !duration) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: couponName, eventId, and duration are required",
        },
        { status: 400 }
      );
    }

    // Validate that either percent_off or amount_off is provided, but not both
    if ((!percent_off && !amount_off) || (percent_off && amount_off)) {
      return NextResponse.json(
        {
          error:
            "Either percent_off or amount_off must be provided, but not both",
        },
        { status: 400 }
      );
    }

    // Validate currency is provided when amount_off is used
    if (amount_off && !currency) {
      return NextResponse.json(
        { error: "Currency is required when using amount_off" },
        { status: 400 }
      );
    }

    // Validate codes array if provided
    if (
      codes &&
      (!Array.isArray(codes) || codes.some((code) => typeof code !== "string"))
    ) {
      return NextResponse.json(
        { error: "Codes must be an array of strings" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseClient();

    const { data: user } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: isAdmin } = await supabase.rpc("is_admin_user", {
      user_id: user.user?.id,
    });

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: pricingTiers, error: pricingTiersError } = await supabase
      .from("pricing_tiers")
      .select("stripe_price_id")
      .eq("event_id", eventId)
      .eq("is_active", true);

    if (pricingTiersError) {
      return NextResponse.json(
        { error: pricingTiersError.message },
        { status: 500 }
      );
    }

    if (!pricingTiers) {
      return NextResponse.json(
        { error: "Pricing tiers not found" },
        { status: 404 }
      );
    }

    const priceIds = pricingTiers.map((tier) => tier.stripe_price_id);

    let productIds = await Promise.all(
      priceIds.map(async (priceId) => {
        const price = await stripe.prices.retrieve(priceId);
        return typeof price.product === "string"
          ? price.product
          : price.product.id;
      })
    );

    productIds = Array.from(new Set(productIds));

    const coupon = await stripe.coupons.create({
      name: couponName,
      percent_off: percent_off || undefined,
      amount_off: amount_off || undefined,
      currency: currency || undefined,
      duration: duration,
      max_redemptions: max_redemptions || undefined,
      redeem_by: redeem_by || undefined,
      applies_to: {
        products: productIds,
      },
    });

    // Add coupon to database
    const { data: insertedCoupon, error: insertError } = await supabase
      .from("coupons")
      .insert({
        event_id: eventId,
        stripe_coupon_id: coupon.id,
        name: couponName,
        codes: codes || null,
        percent_off: percent_off || null,
        amount_off: amount_off || null,
        currency: currency || null,
        duration: duration,
        max_redemptions: max_redemptions || null,
        redeem_by: redeem_by ? new Date(redeem_by).toISOString() : null,
        created_by_user_id: user.user?.id,
      })
      .select()
      .single();

    if (insertError) {
      // If database insertion fails, delete the Stripe coupon to maintain consistency
      try {
        await stripe.coupons.del(coupon.id);
      } catch (deleteError) {
        console.error(
          "Failed to delete Stripe coupon after database error:",
          deleteError
        );
      }

      return NextResponse.json(
        { error: `Failed to save coupon to database: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      coupon: {
        id: insertedCoupon.id,
        stripe_coupon_id: coupon.id,
        name: couponName,
        codes: codes,
        percent_off: percent_off,
        amount_off: amount_off,
        currency: currency,
        duration: duration,
        max_redemptions: max_redemptions,
        redeem_by: redeem_by,
        event_id: eventId,
      },
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    return NextResponse.json(
      { error: "Internal server error while creating coupon" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const { couponId } = await req.json();
  const supabase = await createSupabaseClient();

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("is_admin_user", {
    user_id: user.user.id,
  });
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deletedCoupon = await stripe.coupons.del(couponId);

  if (!deletedCoupon) {
    return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("coupons")
    .delete()
    .eq("id", couponId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}