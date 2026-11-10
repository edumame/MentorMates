import { EventRole } from "@/lib/types";

/**
 * Roles that can be requested and granted through the self-service approval
 * flow. Staff roles (mentor, judge, organizer, admin) are granted only through
 * invitations or role passwords; the database enforces the same rule
 * (supabase/migrations/202611080203_a2_event_role_integrity.sql).
 */
export const APPROVABLE_REQUEST_ROLES = [EventRole.Participant] as const;

export function isApprovableRole(role: unknown): role is EventRole.Participant {
  return (APPROVABLE_REQUEST_ROLES as readonly unknown[]).includes(role);
}
