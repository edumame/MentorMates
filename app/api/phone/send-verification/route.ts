import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { twilioClient, TWILIO_VERIFY_SERVICE_SID } from "@/lib/twilio/twilio";
import { z } from "zod";

// E.164 phone format validation
const PhoneSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, "Phone number must be in E.164 format (e.g., +15555555555)"),
});

// Rate limit: max 3 sends per phone per 10 minutes
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SENDS_PER_WINDOW = 3;

interface RateLimitState {
  sends: { timestamp: number }[];
}

export async function POST(request: NextRequest) {
  try {
    // Check if Twilio is configured
    if (!twilioClient || !TWILIO_VERIFY_SERVICE_SID) {
      console.error("Twilio is not configured");
      return NextResponse.json(
        { error: "Phone verification is not available" },
        { status: 503 }
      );
    }

    const supabase = await createSupabaseClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validationResult = PhoneSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid phone number format",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { phoneNumber } = validationResult.data;

    // Check if phone number already exists for this user
    const { data: existingPhone, error: fetchError } = await supabase
      .from("user_phone_numbers")
      .select("id, verification_status, verification_state")
      .eq("user_id", user.id)
      .eq("phone_number", phoneNumber)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching phone number:", fetchError);
      return NextResponse.json(
        { error: "Failed to check phone number" },
        { status: 500 }
      );
    }

    // If already verified, skip
    if (existingPhone?.verification_status === "verified") {
      return NextResponse.json(
        { error: "Phone number is already verified" },
        { status: 409 }
      );
    }

    // Check rate limiting
    const now = Date.now();
    let rateLimitState: RateLimitState = { sends: [] };

    if (existingPhone?.verification_state) {
      try {
        rateLimitState = JSON.parse(existingPhone.verification_state);
      } catch {
        rateLimitState = { sends: [] };
      }
    }

    // Filter sends within the rate limit window
    const recentSends = (rateLimitState.sends || []).filter(
      (send) => now - send.timestamp < RATE_LIMIT_WINDOW_MS
    );

    if (recentSends.length >= MAX_SENDS_PER_WINDOW) {
      const oldestSend = recentSends[0];
      const waitTimeMs = RATE_LIMIT_WINDOW_MS - (now - oldestSend.timestamp);
      const waitTimeMinutes = Math.ceil(waitTimeMs / 60000);

      return NextResponse.json(
        {
          error: `Rate limit exceeded. Try again in ${waitTimeMinutes} minute${waitTimeMinutes > 1 ? "s" : ""}`,
        },
        { status: 429 }
      );
    }

    // Send verification via Twilio
    try {
      await twilioClient.verify.v2
        .services(TWILIO_VERIFY_SERVICE_SID)
        .verifications.create({
          to: phoneNumber,
          channel: "sms",
        });
    } catch (twilioError) {
      console.error("Twilio verification error:", twilioError);
      return NextResponse.json(
        { error: "Failed to send verification code" },
        { status: 500 }
      );
    }

    // Update rate limit state
    recentSends.push({ timestamp: now });
    const newVerificationState = JSON.stringify({ sends: recentSends });

    // Upsert phone number with pending status
    if (existingPhone) {
      const { error: updateError } = await supabase
        .from("user_phone_numbers")
        .update({
          verification_status: "pending",
          verification_state: newVerificationState,
        })
        .eq("id", existingPhone.id);

      if (updateError) {
        console.error("Error updating phone number:", updateError);
        return NextResponse.json(
          { error: "Failed to update phone status" },
          { status: 500 }
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from("user_phone_numbers")
        .insert({
          user_id: user.id,
          phone_number: phoneNumber,
          verification_status: "pending",
          verification_state: newVerificationState,
        });

      if (insertError) {
        console.error("Error inserting phone number:", insertError);
        return NextResponse.json(
          { error: "Failed to save phone number" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent",
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
