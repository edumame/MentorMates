import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import {
  createSupabaseServiceClient,
  type ServiceSupabaseClient,
} from "@/lib/supabase/service";
import { generateApiKey } from "@/lib/agent/crypto";
import {
  getDefaultScopesForAccessMode,
  type AgentAccessMode,
} from "@/lib/agent/scopes";
import {
  approveRateLimitBucket,
  encryptApiKey,
  isDeviceAuthConfigured,
  normalizeUserCode,
  reserveDeviceAuthAttempt,
  DeviceAuthRateLimitUnavailableError,
  APPROVE_ATTEMPT_LIMIT_PER_USER,
  APPROVE_ATTEMPT_WINDOW_SECONDS,
  DEVICE_AUTH_NOT_CONFIGURED_MESSAGE,
} from "@/lib/agent/device-auth";
import { canAccessRole } from "@/features/user/roles/roles";
import { EventRole } from "@/lib/types";

/**
 * /api/auth/device/approve
 * Called from the /auth/device web page after the user signs in.
 * Requires a Supabase Auth session (cookie-based).
 *
 * GET  ?user_code=XXXX  → preview what the code would grant (no state change)
 * POST { user_code }    → approve; mints exactly one API key per code
 */

const ORGANIZER_MODE_FORBIDDEN_MESSAGE =
  "This device requested organizer access, but your account is not an organizer or admin. Ask the person running the agent to request participant access instead.";

type DeviceRow = {
  id: string;
  access_mode: string;
  status: string;
  expires_at: string;
};

type ValidatedRequest =
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      userId: string;
      serviceClient: ServiceSupabaseClient;
      row: DeviceRow;
      accessMode: AgentAccessMode;
    };

function jsonError(error: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error }, { status, headers });
}

/**
 * Organizer device keys get organizer scopes, so require that the approving
 * user actually holds organizer rights somewhere (an organizer/admin event
 * role) or is a platform admin. Mirrors the check in /api/agent/keys.
 * Throws on lookup errors so callers fail closed.
 */
async function hasOrganizerRights(
  serviceClient: ServiceSupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: isAdmin, error: adminError } = await serviceClient.rpc(
    "is_admin_user",
    { user_id: userId },
  );
  if (adminError) throw adminError;
  if (isAdmin === true) return true;

  const { data: roles, error: rolesError } = await serviceClient
    .from("user_event_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesError) throw rolesError;

  return (roles ?? []).some((roleRow) =>
    canAccessRole(roleRow.role as EventRole, EventRole.Organizer),
  );
}

/** Shared by GET (preview) and POST (approve). Never mutates the code row except to mark it expired. */
async function validateRequest(rawUserCode: unknown): Promise<ValidatedRequest> {
  if (!isDeviceAuthConfigured()) {
    console.error("DEVICE_AUTH_ENCRYPTION_KEY is missing or invalid");
    return { ok: false, response: jsonError(DEVICE_AUTH_NOT_CONFIGURED_MESSAGE, 500) };
  }

  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, response: jsonError("Unauthorized", 401) };
  }

  const userCode = normalizeUserCode(rawUserCode);
  if (!userCode) {
    return {
      ok: false,
      response: jsonError("A valid 8-character user_code is required", 400),
    };
  }

  const serviceClient = createSupabaseServiceClient();

  // Per-user attempt limit: bounds code guessing by a signed-in user.
  try {
    const decision = await reserveDeviceAuthAttempt(
      serviceClient,
      approveRateLimitBucket(user.id),
      APPROVE_ATTEMPT_LIMIT_PER_USER,
      APPROVE_ATTEMPT_WINDOW_SECONDS,
    );
    if (!decision.allowed) {
      return {
        ok: false,
        response: jsonError(
          "Too many attempts. Wait a few minutes and try again.",
          429,
          { "Retry-After": String(decision.retryAfterSeconds) },
        ),
      };
    }
  } catch (error) {
    if (error instanceof DeviceAuthRateLimitUnavailableError) {
      return {
        ok: false,
        response: jsonError("Device authorization is temporarily unavailable", 503),
      };
    }
    throw error;
  }

  const { data: row, error: lookupError } = await serviceClient
    .from("device_auth_codes")
    .select("id, access_mode, status, expires_at")
    .eq("user_code", userCode)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!row) {
    return { ok: false, response: jsonError("Invalid or expired code", 404) };
  }

  if (row.status === "approving" || row.status === "approved") {
    return { ok: false, response: jsonError("Code already used", 409) };
  }

  if (row.status === "expired" || new Date(row.expires_at) <= new Date()) {
    if (row.status === "pending") {
      await serviceClient
        .from("device_auth_codes")
        .update({ status: "expired" })
        .eq("id", row.id)
        .eq("status", "pending");
    }
    return { ok: false, response: jsonError("Code expired", 410) };
  }

  if (row.status !== "pending") {
    return { ok: false, response: jsonError("Invalid or expired code", 404) };
  }

  if (row.access_mode !== "organizer" && row.access_mode !== "participant") {
    return { ok: false, response: jsonError("Invalid or expired code", 404) };
  }
  const accessMode: AgentAccessMode = row.access_mode;

  if (accessMode === "organizer" && !(await hasOrganizerRights(serviceClient, user.id))) {
    return { ok: false, response: jsonError(ORGANIZER_MODE_FORBIDDEN_MESSAGE, 403) };
  }

  return { ok: true, userId: user.id, serviceClient, row, accessMode };
}

export async function GET(request: NextRequest) {
  try {
    const result = await validateRequest(
      request.nextUrl.searchParams.get("user_code"),
    );
    if (!result.ok) return result.response;

    return NextResponse.json({
      access_mode: result.accessMode,
      scopes: getDefaultScopesForAccessMode(result.accessMode),
      expires_at: result.row.expires_at,
    });
  } catch (error) {
    console.error("Device approve GET error:", error);
    return jsonError("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: { user_code?: unknown } | null = null;
    try {
      body = await request.json();
    } catch {
      return jsonError("A valid 8-character user_code is required", 400);
    }

    const result = await validateRequest(body?.user_code);
    if (!result.ok) return result.response;
    const { userId, serviceClient, row, accessMode } = result;

    // Atomically claim the row. Only one concurrent approval can move it
    // from pending → approving; every other request updates zero rows.
    const { data: claimed, error: claimError } = await serviceClient
      .from("device_auth_codes")
      .update({ status: "approving", user_id: userId })
      .eq("id", row.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimed) {
      return jsonError("Code already used or expired", 409);
    }

    const releaseClaim = async () => {
      const { error } = await serviceClient
        .from("device_auth_codes")
        .update({ status: "pending", user_id: null })
        .eq("id", row.id)
        .eq("status", "approving");
      if (error) console.error("Failed to release device auth claim:", error);
    };

    const { raw, hash, prefix } = generateApiKey();
    const { data: keyRow, error: keyError } = await serviceClient
      .from("agent_api_keys")
      .insert({
        user_id: userId,
        key_hash: hash,
        key_prefix: prefix,
        label: "Device auth (auto-generated)",
        scopes: getDefaultScopesForAccessMode(accessMode),
      })
      .select("id")
      .single();

    if (keyError || !keyRow) {
      console.error("Failed to create API key:", keyError);
      await releaseClaim();
      return jsonError("Failed to create API key", 500);
    }

    let finalized = false;
    try {
      const { data: approvedRow, error: updateError } = await serviceClient
        .from("device_auth_codes")
        .update({
          status: "approved",
          api_key_id: keyRow.id,
          api_key_raw_encrypted: encryptApiKey(raw),
        })
        .eq("id", row.id)
        .eq("status", "approving")
        .select("id")
        .maybeSingle();
      if (updateError) {
        console.error("Failed to update device auth:", updateError);
      }
      finalized = !updateError && Boolean(approvedRow);
    } catch (error) {
      console.error("Failed to finalize device auth:", error);
    }

    if (!finalized) {
      // Never leave an undeliverable key behind.
      const { error: deleteError } = await serviceClient
        .from("agent_api_keys")
        .delete()
        .eq("id", keyRow.id);
      if (deleteError) {
        console.error("Failed to delete orphaned device auth key:", deleteError);
      }
      await releaseClaim();
      return jsonError("Failed to approve device", 500);
    }

    return NextResponse.json({
      success: true,
      access_mode: accessMode,
      message: "Device authorized. You can close this window.",
    });
  } catch (error) {
    console.error("Device approve POST error:", error);
    return jsonError("Internal server error", 500);
  }
}
