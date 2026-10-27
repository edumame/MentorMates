import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import {
  createSupabaseServiceClient,
  type ServiceSupabaseClient,
} from "@/lib/supabase/service";
import {
  decryptApiKey,
  isDeviceAuthConfigured,
  DEVICE_AUTH_NOT_CONFIGURED_MESSAGE,
  MIN_POLL_INTERVAL_SECONDS,
} from "@/lib/agent/device-auth";

const MAX_DEVICE_CODE_LENGTH = 256;

function oauthError(error: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

async function deleteApiKey(supabase: ServiceSupabaseClient, apiKeyId: string | null) {
  if (!apiKeyId) return;
  const { error } = await supabase.from("agent_api_keys").delete().eq("id", apiKeyId);
  if (error) console.error("Failed to delete undelivered device auth key:", error);
}

/**
 * POST /api/auth/device/token
 * RFC 8628 Device Access Token endpoint.
 * No auth required — skill polls with device_code.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isDeviceAuthConfigured()) {
      // Checked before any state change so a misconfigured server never
      // consumes an approved row it cannot decrypt.
      console.error("DEVICE_AUTH_ENCRYPTION_KEY is missing or invalid");
      return oauthError("server_error", 500, {
        error_description: DEVICE_AUTH_NOT_CONFIGURED_MESSAGE,
      });
    }

    let body: { device_code?: unknown } | null = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const deviceCode = body?.device_code;

    if (
      !deviceCode ||
      typeof deviceCode !== "string" ||
      deviceCode.length > MAX_DEVICE_CODE_LENGTH
    ) {
      return oauthError("invalid_request", 400, {
        error_description: "device_code is required",
      });
    }

    const deviceCodeHash = createHash("sha256").update(deviceCode).digest("hex");
    const supabase = createSupabaseServiceClient();

    const { data: row, error: lookupError } = await supabase
      .from("device_auth_codes")
      .select("id, status, expires_at, last_polled_at, api_key_id")
      .eq("device_code_hash", deviceCodeHash)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!row) return oauthError("invalid_grant");

    // Expired: mark it, and never leave an undelivered approved key active.
    if (row.status === "expired" || new Date(row.expires_at) <= new Date()) {
      if (row.status === "approved") {
        const { data: removed } = await supabase
          .from("device_auth_codes")
          .delete()
          .eq("id", row.id)
          .eq("status", "approved")
          .select("api_key_id")
          .maybeSingle();
        await deleteApiKey(supabase, removed?.api_key_id ?? null);
      } else if (row.status !== "expired") {
        await supabase
          .from("device_auth_codes")
          .update({ status: "expired" })
          .eq("id", row.id)
          .eq("status", row.status);
      }
      return oauthError("expired_token");
    }

    // Poll throttle (RFC 8628 §3.5). The compare-and-set on last_polled_at
    // means two concurrent polls cannot both pass the interval check.
    if (row.last_polled_at) {
      const elapsed = Date.now() - new Date(row.last_polled_at).getTime();
      if (elapsed < MIN_POLL_INTERVAL_SECONDS * 1000) {
        return oauthError("slow_down", 400, {
          interval: MIN_POLL_INTERVAL_SECONDS + 5,
        });
      }
    }
    const pollUpdate = supabase
      .from("device_auth_codes")
      .update({ last_polled_at: new Date().toISOString() })
      .eq("id", row.id);
    const { data: polled, error: pollError } = await (row.last_polled_at
      ? pollUpdate.eq("last_polled_at", row.last_polled_at)
      : pollUpdate.is("last_polled_at", null)
    )
      .select("id")
      .maybeSingle();
    if (pollError) throw pollError;
    if (!polled) {
      return oauthError("slow_down", 400, {
        interval: MIN_POLL_INTERVAL_SECONDS + 5,
      });
    }

    // "approving" means an approval is mid-flight; keep the client polling.
    if (row.status === "pending" || row.status === "approving") {
      return oauthError("authorization_pending");
    }

    if (row.status !== "approved") {
      return oauthError("invalid_grant");
    }

    // Single-use retrieval: the conditional DELETE ... RETURNING succeeds for
    // exactly one caller; any concurrent or later poller gets invalid_grant.
    const { data: consumed, error: consumeError } = await supabase
      .from("device_auth_codes")
      .delete()
      .eq("id", row.id)
      .eq("status", "approved")
      .select("api_key_raw_encrypted, api_key_id")
      .maybeSingle();

    if (consumeError) throw consumeError;
    if (!consumed) return oauthError("invalid_grant");

    if (!consumed.api_key_raw_encrypted) {
      await deleteApiKey(supabase, consumed.api_key_id);
      return oauthError("invalid_grant");
    }

    let accessToken: string;
    try {
      accessToken = decryptApiKey(consumed.api_key_raw_encrypted);
    } catch (error) {
      console.error("Failed to decrypt device auth key:", error);
      await deleteApiKey(supabase, consumed.api_key_id);
      return oauthError("server_error", 500);
    }

    return NextResponse.json({
      access_token: accessToken,
      token_type: "Bearer",
    });
  } catch (error) {
    console.error("Device token POST error:", error);
    return oauthError("server_error", 500);
  }
}
