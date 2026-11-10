import { SignJWT, jwtVerify } from "jose";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret?.trim()) throw new Error("Invitation signing secret is not configured");
  return new TextEncoder().encode(secret);
};

const EVENT_ROLE_INVITE_PURPOSE = "event_role_invite";
// Invitations are short-lived and bound to a stored, single-use row (jti).
export const EVENT_ROLE_INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;

export type InvitableEventRole = "participant" | "judge" | "organizer";

export interface EventRoleInvitePayload {
  email: string;
  eventId: string;
  role: InvitableEventRole;
  /** id of the event_role_invitations row (see lib/events/role-invitations.ts). */
  jti?: string;
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
    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ["HS256"], requiredClaims: ["exp"] });
    if (typeof payload.email !== "string" || typeof payload.projectId !== "string" ||
        !payload.projectId.trim() || typeof payload.invitedBy !== "string" || !payload.invitedBy.trim() ||
        payload.purpose !== undefined) return null;
    return {
      email: payload.email as string,
      projectId: payload.projectId as string,
      invitedBy: payload.invitedBy as string,
    };
  } catch {
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
  const jwt = new SignJWT({
    purpose: EVENT_ROLE_INVITE_PURPOSE,
    email: payload.email.trim().toLowerCase(),
    eventId: payload.eventId,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`);
  if (payload.jti) jwt.setJti(payload.jti);
  return await jwt.sign(getJwtSecret());
}

/**
 * Verify an event role invitation.
 * @returns The decoded payload, or null if the token is invalid or expired
 */
export async function verifyEventRoleInviteToken(
  token: string
): Promise<EventRoleInvitePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      requiredClaims: ["exp"],
    });
    if (
      payload.purpose !== EVENT_ROLE_INVITE_PURPOSE ||
      typeof payload.email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
      payload.email !== payload.email.toLowerCase() ||
      typeof payload.eventId !== "string" ||
      !payload.eventId.trim() ||
      payload.eventId !== payload.eventId.trim() ||
      typeof payload.role !== "string" ||
      !["participant", "judge", "organizer"].includes(payload.role)
    ) return null;
    return {
      email: payload.email as string,
      eventId: payload.eventId as string,
      role: payload.role as InvitableEventRole,
      ...(typeof payload.jti === "string" && payload.jti ? { jti: payload.jti } : {}),
    };
  } catch {
    return null;
  }
}

const EVENT_CHECKIN_PURPOSE = "event_checkin";
const EVENT_CHECKIN_TTL_SECONDS = 60 * 24 * 60 * 60;

export interface EventCheckinPayload {
  eventId: string;
  userId: string;
}

/**
 * Sign a check-in ticket for one attendee of one event. Only the server issues
 * these (for the signed-in attendee), so a QR code cannot be forged from a
 * known event id + user id. The purpose claim keeps it from being accepted as
 * any other kind of token.
 */
export async function generateEventCheckinToken(
  payload: EventCheckinPayload,
  expiresIn: number = EVENT_CHECKIN_TTL_SECONDS
): Promise<string> {
  return await new SignJWT({
    purpose: EVENT_CHECKIN_PURPOSE,
    eventId: payload.eventId,
    userId: payload.userId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(getJwtSecret());
}

/** @returns The decoded payload, or null if the token is invalid or expired */
export async function verifyEventCheckinToken(
  token: string
): Promise<EventCheckinPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      requiredClaims: ["exp"],
    });
    if (
      payload.purpose !== EVENT_CHECKIN_PURPOSE ||
      typeof payload.eventId !== "string" ||
      !payload.eventId.trim() ||
      typeof payload.userId !== "string" ||
      !payload.userId.trim()
    ) return null;
    return { eventId: payload.eventId, userId: payload.userId };
  } catch {
    return null;
  }
}
