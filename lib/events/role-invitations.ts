import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  EVENT_ROLE_INVITE_TTL_SECONDS,
  generateEventRoleInviteToken,
  verifyEventRoleInviteToken,
  type EventRoleInvitePayload,
} from "@/lib/utils/jwt";

/**
 * Revocable, single-use event role invitations (ORG-012 / MENT-008 round 2).
 *
 * Every emailed token carries the id (jti) of an event_role_invitations row.
 * A token is only honoured while its row is pending (not accepted, not
 * revoked, not expired) and matches the token's event/email/role. Accepting
 * consumes the row, so an old link cannot re-grant access after removal, and
 * removing someone from an event revokes their pending invitations (DB
 * trigger in 202611080302_b_round2.sql).
 */

export type PendingInvite = Required<Pick<EventRoleInvitePayload, "email" | "eventId" | "role" | "jti">>;

export async function issueEventRoleInviteToken(
  payload: Omit<EventRoleInvitePayload, "jti">,
  { invitedBy = null }: { invitedBy?: string | null } = {}
): Promise<string> {
  const email = payload.email.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + EVENT_ROLE_INVITE_TTL_SECONDS * 1000).toISOString();
  const { data, error } = await createSupabaseServiceClient()
    .from("event_role_invitations")
    .insert({ event_id: payload.eventId, email, role: payload.role, invited_by: invitedBy, expires_at: expiresAt })
    .select("id")
    .single();
  if (error || !data) throw new Error("Failed to record invitation");
  return generateEventRoleInviteToken({ email, eventId: payload.eventId, role: payload.role, jti: data.id });
}

/** Verify the signature AND the stored row. Does not consume it. */
export async function getPendingInvite(token: string | null | undefined): Promise<PendingInvite | null> {
  if (typeof token !== "string" || !token) return null;
  const invite = await verifyEventRoleInviteToken(token);
  // Tokens without a stored row (issued before round 2) are no longer valid.
  if (!invite?.jti) return null;

  const { data, error } = await createSupabaseServiceClient()
    .from("event_role_invitations")
    .select("id, event_id, email, role, expires_at, accepted_at, revoked_at")
    .eq("id", invite.jti)
    .maybeSingle();
  if (error) throw new Error("Unable to load invitation. Please try again.");
  if (
    !data ||
    data.accepted_at ||
    data.revoked_at ||
    Date.parse(data.expires_at) <= Date.now() ||
    data.event_id !== invite.eventId ||
    data.email !== invite.email ||
    data.role !== invite.role
  ) {
    return null;
  }
  return { email: invite.email, eventId: invite.eventId, role: invite.role, jti: invite.jti };
}

/** Atomically consume a pending invitation; false if it was already used or revoked. */
export async function consumeInvite(inviteId: string, userId: string): Promise<boolean> {
  const { data, error } = await createSupabaseServiceClient()
    .from("event_role_invitations")
    .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
    .eq("id", inviteId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id");
  if (error) throw new Error("Failed to accept invitation");
  return (data ?? []).length === 1;
}

/** Undo a consume when granting the role failed, so the link can be retried. */
export async function releaseInvite(inviteId: string) {
  await createSupabaseServiceClient()
    .from("event_role_invitations")
    .update({ accepted_at: null, accepted_by: null })
    .eq("id", inviteId);
}
