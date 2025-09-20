import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { stripe } from "@/lib/stripe/stripe";
import { canAccessRole } from "@/features/user/roles/roles";
import { EventRole } from "@/lib/types";

export async function POST(req: Request) {
  const { promoCode, couponId } = await req.json();
  const supabase = await createSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessRole(user.user.role as EventRole, EventRole.Organizer)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existingCoupon = await stripe.promotionCodes.list(promoCode);

  if (existingCoupon.data.length > 0) {
    return NextResponse.json(
      { error: "Coupon already exists" },
      { status: 400 }
    );
  }
  const newCoupon = await stripe.promotionCodes.create({
    code: promoCode,
    coupon: couponId,
    active: true,
  });

  if (!newCoupon) {
    return NextResponse.json(
      { error: "Failed to create promotion code" },
      { status: 500 }
    );
  }

  const { data: oldPromoCodes } = await supabase
    .from("coupons")
    .select("codes")
    .eq("id", couponId)
    .single();

  const { error: insertError } = await supabase
    .from("coupons")
    .insert({
      codes: [promoCode, ...(oldPromoCodes?.codes || [])],
    })
    .eq("id", couponId);

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
  const { promoCode, couponId } = await req.json();
  const supabase = await createSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessRole(user.user.role as EventRole, EventRole.Organizer)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deletedCoupon = await stripe.promotionCodes.update(promoCode, {
    active: false,
  });

  if (!deletedCoupon) {
    return NextResponse.json(
      { error: "Failed to delete promotion code" },
      { status: 500 }
    );
  }

  const { data: oldPromoCodes } = await supabase
    .from("coupons")
    .select("codes")
    .eq("id", couponId)
    .single();

  const { error: updateError } = await supabase
    .from("coupons")
    .update({
      codes: oldPromoCodes?.codes.filter((code: string) => code !== promoCode),
    })
    .eq("id", couponId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to delete promotion code" },
      { status: 500 }
    );
  }
}
