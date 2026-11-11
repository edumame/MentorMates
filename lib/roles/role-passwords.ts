import { EventRole } from "@/lib/types";

/**
 * Roles that can be joined with an organizer-configured role password.
 * Organizer access is invitation-only: an organizer can edit, export and
 * delete the event, so a shared password must never grant it (ORG-013).
 */
export const PASSWORD_JOINABLE_ROLES = [
  EventRole.Participant,
  EventRole.Mentor,
  EventRole.Judge,
] as const;

export type PasswordJoinableRole = (typeof PASSWORD_JOINABLE_ROLES)[number];

/**
 * Staff roles that can never be self-assigned without a configured password
 * (MENT-017: mentors can read private projects and their feedback).
 */
export const PASSWORD_REQUIRED_ROLES: EventRole[] = [EventRole.Judge, EventRole.Mentor];

/** bcrypt only uses the first 72 bytes of a password. */
export const ROLE_PASSWORD_MAX_LENGTH = 72;

export function getRolePasswordMinLength(role: PasswordJoinableRole): number {
  return role === EventRole.Judge || role === EventRole.Mentor ? 12 : 8;
}

export function isPasswordJoinableRole(role: unknown): role is PasswordJoinableRole {
  return (PASSWORD_JOINABLE_ROLES as readonly unknown[]).includes(role);
}

/** Returns an error message, or null when the password is acceptable. */
export function validateRolePassword(role: PasswordJoinableRole, password: string): string | null {
  const min = getRolePasswordMinLength(role);
  if (password.length < min) return `Password must be at least ${min} characters`;
  if (new TextEncoder().encode(password).length > ROLE_PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${ROLE_PASSWORD_MAX_LENGTH} bytes`;
  }
  return null;
}
