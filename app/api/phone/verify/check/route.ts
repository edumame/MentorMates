import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { checkPhoneVerification, normalizePhone } from "@/lib/twilio";

const BodySchema = z.object({
  code: z.string().min(4).max(10),
  phone_number: z.string().min(5).max(50).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.errors },
        { status: 400 }
      );
    }

    let phone = parsed.data.phone_number
      ? normalizePhone(parsed.data.phone_number)
      : null;

    if (!phone) {
      const { data: pending } = await supabase
        .from("user_phone_numbers")
        .select("phone_number")
        .eq("user_id", user.id)
        .eq("verification_status", "pending")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!pending?.phone_number) {
        return NextResponse.json(
          { error: "No pending verification found" },
          { status: 400 }
        );
      }
      phone = normalizePhone(pending.phone_number);
    }

    const approved = await checkPhoneVerification(phone, parsed.data.code);

    if (!approved) {
      await supabase
        .from("user_phone_numbers")
        .update({ verification_status: "failed" })
        .eq("user_id", user.id)
        .eq("phone_number", phone);

      return NextResponse.json(
        { ok: false, error: "Incorrect or expired code" },
        { status: 400 }
      );
    }

    await supabase
      .from("user_phone_numbers")
      .update({
        verification_status: "verified",
        verification_state: "code_verified",
      })
      .eq("user_id", user.id)
      .eq("phone_number", phone);

    return NextResponse.json({ ok: true, phone_number: phone });
  } catch (err) {
    console.error("phone/verify/check error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to check code" },
      { status: 500 }
    );
  }
}
