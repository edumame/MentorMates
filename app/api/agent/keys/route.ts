import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";
import { generateApiKey } from "@/lib/agent/auth";
import {
  agentAccessModeSchema,
  agentScopeModeSchema,
  agentScopeSchema,
  areScopesAllowedForAccessMode,
  getDefaultScopesForAccessMode,
} from "@/lib/agent/scopes";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createKeySchema = z.object({
  event_id: z.string().uuid().optional(),
  access_mode: agentAccessModeSchema.optional().default("organizer"),
  // ORG-023: when omitted, a key minted for an event is scoped to that event;
  // account-wide ("public") keys must be requested explicitly.
  scope_mode: agentScopeModeSchema.optional(),
  label: z.string().max(100).optional().default("default"),
  scopes: z.array(agentScopeSchema).optional(),
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

    const body = await request.json().catch(() => null);
    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { event_id, access_mode, label } = parsed.data;
    const scope_mode = parsed.data.scope_mode ?? (event_id ? "event" : "public");
    const scopes = parsed.data.scopes ?? getDefaultScopesForAccessMode(access_mode);

    if (!areScopesAllowedForAccessMode(access_mode, scopes)) {
      return NextResponse.json(
        { error: "Requested scopes are not allowed for this access mode" },
        { status: 400 }
      );
    }

    if (scope_mode === "event" && !event_id) {
      return NextResponse.json(
        { error: "event_id is required for event-specific keys" },
        { status: 400 }
      );
    }

    if (access_mode === "organizer") {
      if (!event_id) {
        return NextResponse.json(
          { error: "event_id is required for organizer keys" },
          { status: 400 }
        );
      }

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
          { error: "Only organizers can generate organizer agent keys" },
          { status: 403 }
        );
      }
    } else if (scope_mode === "event" && event_id) {
      const { data: roleRow } = await supabase
        .from("user_event_roles")
        .select("role")
        .eq("event_id", event_id)
        .eq("user_id", user.id)
        .maybeSingle();

      const isParticipant =
        roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Participant);

      if (!isParticipant) {
        return NextResponse.json(
          { error: "You need event access before creating an event-scoped participant key" },
          { status: 403 }
        );
      }
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
            : access_mode === "participant"
              ? "Save this API key — it will not be shown again. Use it as: Authorization: Bearer <key> on /api/agent/me/events requests."
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
      // ORG-023: an event's Agent Keys tab lists keys scoped to that event
      // plus the user's account-wide keys (event_id null, e.g. created from an
      // event console before keys were event-scoped). The UI labels the
      // latter "All your events" so revoking one is a deliberate choice.
      // eventId is validated as a UUID, so the filter string is safe.
      if (!UUID_RE.test(eventId)) {
        return NextResponse.json({ error: "Invalid event_id" }, { status: 400 });
      }
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
