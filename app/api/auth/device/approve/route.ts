import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { generateApiKey } from "@/lib/agent/crypto";
import { getDefaultScopesForAccessMode } from "@/lib/agent/scopes";
import { encryptApiKey } from "@/lib/agent/device-auth";

/**
 * POST /api/auth/device/approve
 * Called from the /auth/device web page after user signs in.
 * Requires Supabase Auth session (cookie-based).
 */
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

    const body = await request.json();
    const userCode = body.user_code;

    if (!userCode || typeof userCode !== "string") {
      return NextResponse.json(
        { error: "user_code is required" },
        { status: 400 },
      );
    }

    const serviceClient = createSupabaseServiceClient();

    // Look up the device auth code
    const { data: row, error: lookupError } = await serviceClient
      .from("device_auth_codes")
      .select("*")
      .eq("user_code", userCode.toUpperCase().trim())
      .single();

    if (lookupError || !row) {
      return NextResponse.json(
        { error: "Invalid or expired code" },
        { status: 400 },
      );
    }

    if (row.status !== "pending") {
      return NextResponse.json(
        { error: "Code already used" },
        { status: 400 },
      );
    }

    if (new Date(row.expires_at) < new Date()) {
      await serviceClient
        .from("device_auth_codes")
        .update({ status: "expired" })
        .eq("id", row.id);
      return NextResponse.json(
        { error: "Code expired" },
        { status: 400 },
      );
    }

    // Generate an API key for this user
    const { raw, hash, prefix } = generateApiKey();
    const scopes = getDefaultScopesForAccessMode(
      row.access_mode as "organizer" | "participant",
    );

    const { data: keyRow, error: keyError } = await serviceClient
      .from("agent_api_keys")
      .insert({
        user_id: user.id,
        key_hash: hash,
        key_prefix: prefix,
        label: "Device auth (auto-generated)",
        scopes,
      })
      .select("id")
      .single();

    if (keyError || !keyRow) {
      console.error("Failed to create API key:", keyError);
      return NextResponse.json(
        { error: "Failed to create API key" },
        { status: 500 },
      );
    }

    // Encrypt the raw key and store it on the device auth row
    const encrypted = encryptApiKey(raw);

    const { error: updateError } = await serviceClient
      .from("device_auth_codes")
      .update({
        status: "approved",
        user_id: user.id,
        api_key_id: keyRow.id,
        api_key_raw_encrypted: encrypted,
      })
      .eq("id", row.id);

    if (updateError) {
      console.error("Failed to update device auth:", updateError);
      return NextResponse.json(
        { error: "Failed to approve device" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Device authorized. You can close this window.",
    });
  } catch (error) {
    console.error("Device approve POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
