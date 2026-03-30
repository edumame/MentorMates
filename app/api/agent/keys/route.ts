import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";
import { generateApiKey } from "@/lib/agent/auth";

const createKeySchema = z.object({
  event_id: z.string().uuid(),
  scope_mode: z.enum(["public", "event"]).optional().default("public"),
  label: z.string().max(100).optional().default("default"),
  scopes: z
    .array(z.string())
    .optional()
    .default([
      "event:read",
      "event:write",
      "participants:read",
      "participants:write",
      "projects:read",
      "projects:write",
    ]),
});

// POST: Generate a reusable API key after verifying event access
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
    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { event_id, scope_mode, label, scopes } = parsed.data;

    // Verify user is organizer/admin for this event
    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", event_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: isAdminRpc } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });

    const isOrganizer =
      roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Organizer);

    if (!isOrganizer && !Boolean(isAdminRpc)) {
      return NextResponse.json(
        { error: "Only organizers can generate API keys" },
        { status: 403 }
      );
    }

    const { raw, hash, prefix } = generateApiKey();

    const { data: keyRow, error: insertError } = await supabase
      .from("agent_api_keys")
      .insert({
        user_id: user.id,
        event_id: scope_mode === "event" ? event_id : null,
        key_hash: hash,
        key_prefix: prefix,
        label,
        scopes,
      })
      .select("id, event_id, key_prefix, label, scopes, created_at")
      .single();

    if (insertError) {
      console.error("Error creating API key:", insertError);
      return NextResponse.json(
        { error: "Failed to create API key" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        api_key: raw, // Only shown once!
        key: {
          id: keyRow.id,
          event_id: keyRow.event_id,
          prefix: keyRow.key_prefix,
          label: keyRow.label,
          scopes: keyRow.scopes,
          created_at: keyRow.created_at,
        },
        message:
          scope_mode === "event"
            ? "Save this API key — it will not be shown again. This key is scoped to the selected event."
            : "Save this API key — it will not be shown again. Use it as: Authorization: Bearer <key> and include ?event_id=<event_uuid> on /api/agent/events requests.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in agent keys POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET: List API keys for user's events
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventId = request.nextUrl.searchParams.get("event_id");

    let query = supabase
      .from("agent_api_keys")
      .select(
        "id, event_id, key_prefix, label, scopes, last_used_at, expires_at, revoked_at, created_at"
      )
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (eventId) {
      query = query.or(`event_id.eq.${eventId},event_id.is.null`);
    }

    const { data: keys, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch keys" },
        { status: 500 }
      );
    }

    return NextResponse.json({ keys });
  } catch (error) {
    console.error("Error in agent keys GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Revoke an API key
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { key_id } = await request.json();
    if (!key_id) {
      return NextResponse.json(
        { error: "key_id is required" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("agent_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", key_id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to revoke key" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "API key revoked" });
  } catch (error) {
    console.error("Error in agent keys DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
