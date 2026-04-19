import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  decryptApiKey,
  MIN_POLL_INTERVAL_SECONDS,
} from "@/lib/agent/device-auth";

/**
 * POST /api/auth/device/token
 * RFC 8628 Device Access Token endpoint.
 * No auth required — skill polls with device_code.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const deviceCode = body.device_code;

    if (!deviceCode || typeof deviceCode !== "string") {
      return NextResponse.json(
        { error: "invalid_request", error_description: "device_code is required" },
        { status: 400 },
      );
    }

    const deviceCodeHash = createHash("sha256").update(deviceCode).digest("hex");
    const supabase = createSupabaseServiceClient();

    const { data: row, error: lookupError } = await supabase
      .from("device_auth_codes")
      .select("*")
      .eq("device_code_hash", deviceCodeHash)
      .single();

    if (lookupError || !row) {
      return NextResponse.json(
        { error: "invalid_grant" },
        { status: 400 },
      );
    }

    // Check expiry
    if (new Date(row.expires_at) < new Date()) {
      await supabase
        .from("device_auth_codes")
        .update({ status: "expired" })
        .eq("id", row.id);
      return NextResponse.json(
        { error: "expired_token" },
        { status: 400 },
      );
    }

    // Rate limit
    if (row.last_polled_at) {
      const elapsed = Date.now() - new Date(row.last_polled_at).getTime();
      if (elapsed < MIN_POLL_INTERVAL_SECONDS * 1000) {
        return NextResponse.json(
          { error: "slow_down", interval: MIN_POLL_INTERVAL_SECONDS + 5 },
          { status: 400 },
        );
      }
    }

    // Update last_polled_at
    await supabase
      .from("device_auth_codes")
      .update({ last_polled_at: new Date().toISOString() })
      .eq("id", row.id);

    // Still pending
    if (row.status === "pending") {
      return NextResponse.json(
        { error: "authorization_pending" },
        { status: 400 },
      );
    }

    // Approved — return the token
    if (row.status === "approved" && row.api_key_raw_encrypted) {
      const accessToken = decryptApiKey(row.api_key_raw_encrypted);

      // Clear encrypted key + delete row (one-time retrieval)
      await supabase.from("device_auth_codes").delete().eq("id", row.id);

      return NextResponse.json({
        access_token: accessToken,
        token_type: "Bearer",
      });
    }

    // Shouldn't reach here, but handle gracefully
    return NextResponse.json(
      { error: "invalid_grant" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Device token POST error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 },
    );
  }
}
