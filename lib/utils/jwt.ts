import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export type RegistrationClaims = {
  eventId: string;
  name: string;
  email: string;
};

export async function signRegistrationJwt(
  claims: RegistrationClaims,
  expiresIn: string = "14d"
) {
  const jti = crypto.randomUUID();
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyRegistrationJwt(token: string) {
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  // payload: { sub, jti, iat, exp, eventId, name, email }
  return payload as RegistrationClaims;
}
