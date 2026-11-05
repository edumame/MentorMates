import { SignJWT, jwtVerify } from "jose";

const getJwtSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

const EVENT_ROLE_INVITE_PURPOSE = "event_role_invite";
const EVENT_ROLE_INVITE_TTL_SECONDS = 30 * 24 * 60 * 60;

export type InvitableEventRole = "participant" | "judge" | "organizer";

export interface EventRoleInvitePayload {
  email: string;
  eventId: string;
  role: InvitableEventRole;
}

export interface ProjectInvitePayload {
  email: string;
  projectId: string;
  invitedBy: string;
}

/**
 * Generate a JWT token for project invitations
 * @param payload The invitation data
 * @param expiresIn Expiration time in seconds (default: 10 minutes)
 */
export async function generateProjectInviteToken(
  payload: ProjectInvitePayload,
  expiresIn: number = 600 // 10 minutes
): Promise<string> {
  return await new SignJWT({
    email: payload.email,
    projectId: payload.projectId,
    invitedBy: payload.invitedBy,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(getJwtSecret());
}

/**
 * Verify and decode a project invite JWT token
 * @param token The JWT token to verify
 * @returns The decoded payload or null if invalid
 */
export async function verifyProjectInviteToken(
  token: string
): Promise<ProjectInvitePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return {
      email: payload.email as string,
      projectId: payload.projectId as string,
      invitedBy: payload.invitedBy as string,
    };
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

/**
 * Generate a signed invitation for one email, event and role. The purpose claim
 * keeps these tokens from being interchangeable with project invite tokens.
 */
export async function generateEventRoleInviteToken(
  payload: EventRoleInvitePayload,
  expiresIn: number = EVENT_ROLE_INVITE_TTL_SECONDS
): Promise<string> {
  return await new SignJWT({
    purpose: EVENT_ROLE_INVITE_PURPOSE,
    email: payload.email.trim().toLowerCase(),
    eventId: payload.eventId,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(getJwtSecret());
}

/**
 * Verify an event role invitation.
 * @returns The decoded payload, or null if the token is invalid or expired
 */
export async function verifyEventRoleInviteToken(
  token: string
): Promise<EventRoleInvitePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.purpose !== EVENT_ROLE_INVITE_PURPOSE) return null;
    return {
      email: payload.email as string,
      eventId: payload.eventId as string,
      role: payload.role as InvitableEventRole,
    };
  } catch {
    return null;
  }
}
