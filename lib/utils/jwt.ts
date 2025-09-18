import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export type CheckinClaims = {
  eventId: string;
  userId: string;
};

export async function signCheckinJwt(
  claims: CheckinClaims,
  expiresIn: string = "30d"
) {
  
  const jti = crypto.randomUUID();
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyJwt(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    // payload: { sub, jti, iat, exp, eventId, userId }
    return payload as CheckinClaims;
  } catch (error) {
    throw new Error(`Invalid token: ${error}`);
  }
}