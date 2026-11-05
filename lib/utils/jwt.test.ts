/** @jest-environment node */

import {
  generateEventRoleInviteToken,
  generateProjectInviteToken,
  verifyEventRoleInviteToken,
  verifyProjectInviteToken,
} from "./jwt";

describe("event role invite tokens", () => {
  const originalSecret = process.env.JWT_SECRET;
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
    process.env.JWT_SECRET = originalSecret;
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
