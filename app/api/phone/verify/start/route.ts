import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { normalizePhone, startPhoneVerification } from "@/lib/twilio";

const BodySchema = z.object({
  // Optional. If omitted, we use the caller's most-recent stored phone number.
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
      const { data: existing } = await supabase
        .from("user_phone_numbers")
        .select("phone_number")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!existing?.phone_number) {
        return NextResponse.json(
          { error: "No phone number on file. Add one first." },
          { status: 400 }
        );
      }
      phone = normalizePhone(existing.phone_number);
    }

    // Upsert the phone row in pending state. Already-verified numbers don't need re-verification.
    const { data: existingRow } = await supabase
      .from("user_phone_numbers")
      .select("id, verification_status")
      .eq("user_id", user.id)
      .eq("phone_number", phone)
      .maybeSingle();

    if (existingRow?.verification_status === "verified") {
      return NextResponse.json({
        ok: true,
        already_verified: true,
        phone_number: phone,
      });
    }

    if (existingRow) {
      await supabase
        .from("user_phone_numbers")
        .update({ verification_status: "pending", verification_state: "code_sent" })
        .eq("id", existingRow.id);
    } else {
      await supabase.from("user_phone_numbers").insert({
        user_id: user.id,
        phone_number: phone,
        verification_status: "pending",
        verification_state: "code_sent",
      });
    }

    await startPhoneVerification(phone);

    return NextResponse.json({ ok: true, phone_number: phone });
  } catch (err) {
    console.error("phone/verify/start error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start verification" },
      { status: 500 }
    );
  }
}
