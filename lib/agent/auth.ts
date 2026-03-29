import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { canAccessRole } from "@/features/user/roles/roles";
import { EventRole } from "@/lib/types";
import { hashApiKey } from "./crypto";

export { generateApiKey, hashApiKey } from "./crypto";

export interface AgentAuthContext {
  userId: string;
  eventId: string;
  scopes: string[];
  keyId: string;
}

export interface AgentEventAuthorization {
  eventId: string;
  isAdmin: boolean;
  isOwner: boolean;
  userRole: EventRole | null;
}

/**
 * Authenticate an agent API request via Bearer token.
 * Returns the auth context or a NextResponse error.
 */
export async function authenticateAgentRequest(
  request: NextRequest
): Promise<AgentAuthContext | NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header. Use: Bearer <api_key>" },
      { status: 401 }
    );
  }

  const rawKey = authHeader.slice(7);
  if (!rawKey.startsWith("mm_sk_")) {
    return NextResponse.json(
      { error: "Invalid API key format" },
      { status: 401 }
    );
  }

  const keyHash = hashApiKey(rawKey);
  const supabase = createSupabaseServiceClient();

  const { data: keyRow, error } = await supabase
    .from("agent_api_keys")
    .select("id, user_id, event_id, scopes, expires_at, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !keyRow) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  if (keyRow.revoked_at) {
    return NextResponse.json({ error: "API key has been revoked" }, { status: 401 });
  }

  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "API key has expired" }, { status: 401 });
  }

  // Update last_used_at (fire-and-forget)
  supabase
    .from("agent_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {});

  return {
    userId: keyRow.user_id,
    eventId: keyRow.event_id,
    scopes: keyRow.scopes || [],
    keyId: keyRow.id,
  };
}

/**
 * Check if the auth context has a required scope.
 */
export function hasScope(auth: AgentAuthContext, scope: string): boolean {
  return auth.scopes.includes(scope);
}

/**
 * Helper to return a 403 if a scope is missing.
 */
export function requireScope(auth: AgentAuthContext, scope: string): NextResponse | null {
  if (!hasScope(auth, scope)) {
    return NextResponse.json(
      { error: `Insufficient permissions. Required scope: ${scope}` },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Verify the API key owner still has live access to the event tied to the key.
 */
export async function authorizeAgentEventAccess(
  auth: AgentAuthContext,
  minimumRole: EventRole = EventRole.Organizer
): Promise<AgentEventAuthorization | NextResponse> {
  if (!auth.eventId) {
    return NextResponse.json(
      { error: "API key is not associated with an event" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  const [
    { data: event, error: eventError },
    { data: roleRow, error: roleError },
    { data: isAdminRpc, error: adminError },
    { data: isOrganizerOrOwnerRpc, error: organizerOrOwnerError },
  ] =
    await Promise.all([
      supabase
        .from("events")
        .select("owner_id")
        .eq("event_id", auth.eventId)
        .maybeSingle(),
      supabase
        .from("user_event_roles")
        .select("role")
        .eq("event_id", auth.eventId)
        .eq("user_id", auth.userId)
        .maybeSingle(),
      supabase.rpc("is_admin_user", { user_id: auth.userId }),
      supabase.rpc("is_event_organizer_or_owner", {
        p_event_id: auth.eventId,
        p_user_id: auth.userId,
      }),
    ]);

  if (eventError || roleError || adminError || organizerOrOwnerError) {
    throw eventError || roleError || adminError || organizerOrOwnerError;
  }

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const isAdmin = Boolean(isAdminRpc);
  const isOwner = event.owner_id === auth.userId;
  const userRole = roleRow?.role ? (roleRow.role as EventRole) : null;
  const isOrganizerOrOwner = Boolean(isOrganizerOrOwnerRpc);

  if (
    isAdmin ||
    isOwner ||
    isOrganizerOrOwner ||
    (userRole && canAccessRole(userRole, minimumRole))
  ) {
    return {
      eventId: auth.eventId,
      isAdmin,
      isOwner,
      userRole,
    };
  }

  return NextResponse.json(
    { error: "The API key owner no longer has permission to access this event" },
    { status: 403 }
  );
}
