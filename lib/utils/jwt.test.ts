/** @jest-environment node */

import { SignJWT } from "jose";
import {
  generateEventRoleInviteToken,
  generateProjectInviteToken,
  verifyEventRoleInviteToken,
  verifyProjectInviteToken,
} from "./jwt";

describe("event role invite tokens", () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const invite = {
    email: " Judge@Email.com ",
    eventId: "event-1",
    role: "judge" as const,
  };

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-with-enough-length-for-hs256";
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
    jest.restoreAllMocks();
  });

  it("round-trips the invite with a normalized email", async () => {
    const token = await generateEventRoleInviteToken(invite);

    await expect(verifyEventRoleInviteToken(token)).resolves.toEqual({
      email: "judge@email.com",
      eventId: "event-1",
      role: "judge",
    });
  });

  it("rejects a tampered token", async () => {
    const token = await generateEventRoleInviteToken(invite);
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({
        purpose: "event_role_invite",
        email: "attacker@email.com",
        eventId: "event-1",
        role: "organizer",
      })
    ).toString("base64url");

    await expect(
      verifyEventRoleInviteToken(`${header}.${forgedPayload}.${signature}`)
    ).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await generateEventRoleInviteToken(invite, -60);

    await expect(verifyEventRoleInviteToken(token)).resolves.toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await generateEventRoleInviteToken(invite);
    process.env.JWT_SECRET = "a-different-secret-with-enough-length";

    await expect(verifyEventRoleInviteToken(token)).resolves.toBeNull();
  });

  it.each([
    { email: undefined },
    { email: 42 },
    { email: "not-an-email" },
    { email: "Judge@email.com" },
    { eventId: undefined },
    { eventId: " " },
    { eventId: 42 },
    { role: undefined },
    { role: "admin" },
    { role: ["judge"] },
    { purpose: "project_invite" },
  ])("rejects malformed signed claims: %j", async (invalidClaims) => {
    const token = await new SignJWT({
      purpose: "event_role_invite",
      email: "judge@email.com",
      eventId: "event-1",
      role: "judge",
      ...invalidClaims,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

    await expect(verifyEventRoleInviteToken(token)).resolves.toBeNull();
  });

  it("rejects signed tokens without an expiry", async () => {
    const token = await new SignJWT({
      purpose: "event_role_invite",
      ...invite,
      email: "judge@email.com",
    })
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

    await expect(verifyEventRoleInviteToken(token)).resolves.toBeNull();
  });

  it("rejects another HMAC algorithm even with the correct secret", async () => {
    const token = await new SignJWT({
      purpose: "event_role_invite",
      ...invite,
      email: "judge@email.com",
    })
      .setProtectedHeader({ alg: "HS384" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

    await expect(verifyEventRoleInviteToken(token)).resolves.toBeNull();
  });

  it("fails closed when signing secrets are missing", async () => {
    const token = await generateEventRoleInviteToken(invite);
    delete process.env.JWT_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(generateEventRoleInviteToken(invite)).rejects.toThrow("not configured");
    await expect(verifyEventRoleInviteToken(token)).resolves.toBeNull();
  });

  it("supports the existing service-key fallback", async () => {
    delete process.env.JWT_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-fallback-key-with-enough-length";
    const token = await generateEventRoleInviteToken(invite);

    await expect(verifyEventRoleInviteToken(token)).resolves.toMatchObject({
      eventId: "event-1",
      role: "judge",
    });
  });

  it("does not accept project invite tokens as role invites", async () => {
    const token = await generateProjectInviteToken({
      email: "judge@email.com",
      projectId: "project-1",
      invitedBy: "lead@email.com",
    });

    await expect(verifyEventRoleInviteToken(token)).resolves.toBeNull();
  });

  it("does not expose a project id from a role invite", async () => {
    const token = await generateEventRoleInviteToken(invite);

    const payload = await verifyProjectInviteToken(token);

    expect(payload?.projectId).toBeUndefined();
  });
});
