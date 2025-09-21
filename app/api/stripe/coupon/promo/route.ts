import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { stripe } from "@/lib/stripe/stripe";
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
    }

    // Get promo codes for all coupons in this event
    const { data: promoCodes, error } = await supabase
      .from("promo_codes")
      .select(
        `
        *,
        coupons!inner(
          id,
          name,
          event_id
        )
      `
      )
      .eq("coupons.event_id", eventId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform the data to include coupon name directly
    const transformedPromoCodes =
      promoCodes?.map((promoCode) => ({
        ...promoCode,
        coupon_name: promoCode.coupons?.name || "Unknown Coupon",
      })) || [];

    return NextResponse.json({ promoCodes: transformedPromoCodes });
  } catch (error) {
    console.error("Error fetching promo codes:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching promo codes" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const { promoCode, couponId } = await req.json();
  const supabase = await createSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("is_admin_user", {
    user_id: user.user.id,
  });

  if (!isAdmin) {
    if (!canAccessRole(user.user.role as EventRole, EventRole.Organizer)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const existingCoupon = await stripe.promotionCodes.list({ code: promoCode });

  if (existingCoupon.data.length > 0) {
    return NextResponse.json(
      { error: "Coupon already exists" },
      { status: 400 }
    );
  }
  const { data: coupon } = await supabase
    .from("coupons")
    .select("stripe_coupon_id")
    .eq("id", couponId)
    .single();

  if (!coupon) {
    return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
  }
  const createdPromoCode = await stripe.promotionCodes.create({
    code: promoCode,
    coupon: coupon.stripe_coupon_id,
    active: true,
  });

  if (!createdPromoCode) {
    return NextResponse.json(
      { error: "Failed to create promotion code" },
      { status: 500 }
    );
  }

  const { error: insertError } = await supabase
    .from("promo_codes")
    .insert({
      code: promoCode,
      coupon_id: couponId,
    })
    .eq("coupon_id", couponId);

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to insert promotion code" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Promotion code created successfully",
  });
}

export async function DELETE(req: Request) {
  const { promoCode } = await req.json();
  const supabase = await createSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("is_admin_user", {
    user_id: user.user.id,
  });

  if (!isAdmin) {
    if (!canAccessRole(user.user.role as EventRole, EventRole.Organizer)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // First find the promotion code
  const promotionCodes = await stripe.promotionCodes.list({ code: promoCode });

  if (promotionCodes.data.length === 0) {
    return NextResponse.json(
      { error: "Promotion code not found" },
      { status: 404 }
    );
  }

  const deletedCoupon = await stripe.promotionCodes.update(
    promotionCodes.data[0].id,
    {
      active: false,
    }
  );

  if (!deletedCoupon) {
    return NextResponse.json(
      { error: "Failed to delete promotion code" },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabase
    .from("promo_codes")
    .delete()
    .eq("code", promoCode);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to delete promotion code" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
