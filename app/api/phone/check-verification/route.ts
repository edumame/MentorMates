import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { twilioClient, TWILIO_VERIFY_SERVICE_SID } from "@/lib/twilio/twilio";
import { z } from "zod";

const CheckVerificationSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, "Phone number must be in E.164 format"),
  code: z
    .string()
    .regex(/^\d{6}$/, "Verification code must be 6 digits"),
});

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
    const validationResult = CheckVerificationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { phoneNumber, code } = validationResult.data;

    // Check if phone number exists for this user with pending status
    const { data: existingPhone, error: fetchError } = await supabase
      .from("user_phone_numbers")
      .select("id, verification_status")
      .eq("user_id", user.id)
      .eq("phone_number", phoneNumber)
      .single();

    if (fetchError || !existingPhone) {
      return NextResponse.json(
        { error: "No pending verification found for this phone number" },
        { status: 404 }
      );
    }

    if (existingPhone.verification_status === "verified") {
      return NextResponse.json({
        success: true,
        verified: true,
        message: "Phone number is already verified",
      });
    }

    if (existingPhone.verification_status !== "pending") {
      return NextResponse.json(
        { error: "No pending verification found. Please request a new code." },
        { status: 400 }
      );
    }

    // Check verification with Twilio
    try {
      const verificationCheck = await twilioClient.verify.v2
        .services(TWILIO_VERIFY_SERVICE_SID)
        .verificationChecks.create({
          to: phoneNumber,
          code: code,
        });

      if (verificationCheck.status === "approved") {
        // Update phone number to verified
        const { error: updateError } = await supabase
          .from("user_phone_numbers")
          .update({
            verification_status: "verified",
            verification_state: JSON.stringify({
              verifiedAt: new Date().toISOString(),
            }),
          })
          .eq("id", existingPhone.id);

        if (updateError) {
          console.error("Error updating verification status:", updateError);
          return NextResponse.json(
            { error: "Failed to update verification status" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          verified: true,
          message: "Phone number verified successfully",
        });
      } else if (verificationCheck.status === "pending") {
        // Wrong code, still pending
        return NextResponse.json(
          {
            success: false,
            verified: false,
            error: "Invalid verification code. Please try again.",
          },
          { status: 400 }
        );
      } else {
        // Expired or other status
        const { error: updateError } = await supabase
          .from("user_phone_numbers")
          .update({
            verification_status: "expired",
          })
          .eq("id", existingPhone.id);

        if (updateError) {
          console.error("Error updating expired status:", updateError);
        }

        return NextResponse.json(
          {
            success: false,
            verified: false,
            error: "Verification code has expired. Please request a new code.",
          },
          { status: 410 }
        );
      }
    } catch (twilioError: unknown) {
      console.error("Twilio verification check error:", twilioError);

      // Check if it's a "max attempts reached" error
      if (
        twilioError instanceof Error &&
        twilioError.message?.includes("Max check attempts reached")
      ) {
        const { error: updateError } = await supabase
          .from("user_phone_numbers")
          .update({
            verification_status: "failed",
          })
          .eq("id", existingPhone.id);

        if (updateError) {
          console.error("Error updating failed status:", updateError);
        }

        return NextResponse.json(
          {
            error: "Maximum verification attempts exceeded. Please request a new code.",
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "Failed to verify code" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
