import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  generateUserCode,
  generateDeviceCode,
  DEVICE_CODE_TTL_SECONDS,
  MIN_POLL_INTERVAL_SECONDS,
} from "@/lib/agent/device-auth";

const MAX_COLLISION_RETRIES = 3;

/**
 * POST /api/auth/device
 * RFC 8628 Device Authorization endpoint.
 * No auth required — generates a device_code + user_code pair.
 */
export async function POST(request: NextRequest) {
  try {
    let accessMode: "organizer" | "participant" = "participant";
    try {
      const body = await request.json();
      if (body.access_mode === "organizer") accessMode = "organizer";
    } catch {
      // No body or invalid JSON — use default
    }

    const supabase = createSupabaseServiceClient();
    const { raw: deviceCodeRaw, hash: deviceCodeHash } = generateDeviceCode();
    const expiresAt = new Date(
      Date.now() + DEVICE_CODE_TTL_SECONDS * 1000,
    ).toISOString();

    let userCode = "";
    let inserted = false;

    for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
      userCode = generateUserCode();
      const { error } = await supabase.from("device_auth_codes").insert({
        device_code_hash: deviceCodeHash,
        user_code: userCode,
        access_mode: accessMode,
        status: "pending",
        expires_at: expiresAt,
      });
      if (!error) {
        inserted = true;
        break;
      }
      // Unique constraint violation on user_code — retry
      if (!error.message?.includes("unique") && !error.code?.includes("23505")) {
        throw error;
      }
    }

    if (!inserted) {
      return NextResponse.json(
        { error: "Failed to generate unique code. Try again." },
        { status: 500 },
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://www.mentormates.ai";

    return NextResponse.json({
      device_code: deviceCodeRaw,
      user_code: userCode,
      verification_uri: `${baseUrl}/auth/device`,
      verification_uri_complete: `${baseUrl}/auth/device?code=${userCode}`,
      expires_in: DEVICE_CODE_TTL_SECONDS,
      interval: MIN_POLL_INTERVAL_SECONDS,
    });
  } catch (error) {
    console.error("Device auth POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
