import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  generateUserCode,
  generateDeviceCode,
  getClientIp,
  createCodeRateLimitBucket,
  isDeviceAuthConfigured,
  reserveDeviceAuthAttempt,
  DeviceAuthRateLimitUnavailableError,
  CREATE_CODE_LIMIT_PER_IP,
  CREATE_CODE_WINDOW_SECONDS,
  DEVICE_AUTH_NOT_CONFIGURED_MESSAGE,
  DEVICE_CODE_TTL_SECONDS,
  MAX_PENDING_DEVICE_CODES,
  MIN_POLL_INTERVAL_SECONDS,
} from "@/lib/agent/device-auth";

const MAX_COLLISION_RETRIES = 3;

/**
 * POST /api/auth/device
 * RFC 8628 Device Authorization endpoint.
 * No auth required — generates a device_code + user_code pair.
 * The requested access_mode is only a request: organizer mode is authorized
 * against the approving user's roles in /api/auth/device/approve.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isDeviceAuthConfigured()) {
      console.error("DEVICE_AUTH_ENCRYPTION_KEY is missing or invalid");
      return NextResponse.json(
        { error: "server_error", error_description: DEVICE_AUTH_NOT_CONFIGURED_MESSAGE },
        { status: 500 },
      );
    }

    let accessMode: "organizer" | "participant" = "participant";
    try {
      const body = await request.json();
      if (body?.access_mode === "organizer") accessMode = "organizer";
    } catch {
      // No body or invalid JSON — use default
    }

    const supabase = createSupabaseServiceClient();

    // Per-client-IP limit on code creation (fails closed).
    let decision;
    try {
      decision = await reserveDeviceAuthAttempt(
        supabase,
        createCodeRateLimitBucket(getClientIp(request.headers)),
        CREATE_CODE_LIMIT_PER_IP,
        CREATE_CODE_WINDOW_SECONDS,
      );
    } catch (error) {
      if (error instanceof DeviceAuthRateLimitUnavailableError) {
        return NextResponse.json(
          { error: "temporarily_unavailable" },
          { status: 503 },
        );
      }
      throw error;
    }
    if (!decision.allowed) {
      return NextResponse.json(
        {
          error: "slow_down",
          error_description: "Too many device codes requested. Try again later.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(decision.retryAfterSeconds) },
        },
      );
    }

    // Global cap on outstanding codes. This is a soft bound (concurrent
    // requests may overshoot slightly); the per-IP limit above is atomic.
    const nowIso = new Date().toISOString();
    const { count: pendingCount, error: countError } = await supabase
      .from("device_auth_codes")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .gt("expires_at", nowIso);
    if (countError || pendingCount === null) {
      console.error("Device auth pending count failed:", countError);
      return NextResponse.json(
        { error: "temporarily_unavailable" },
        { status: 503 },
      );
    }
    if (pendingCount >= MAX_PENDING_DEVICE_CODES) {
      return NextResponse.json(
        {
          error: "temporarily_unavailable",
          error_description: "Too many pending device codes. Try again later.",
        },
        { status: 503, headers: { "Retry-After": "60" } },
      );
    }

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
      verification_uri_complete: `${baseUrl}/auth/device?code=${encodeURIComponent(userCode)}`,
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
