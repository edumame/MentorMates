import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    .sign(JWT_SECRET);
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
    const { payload } = await jwtVerify(token, JWT_SECRET);
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
