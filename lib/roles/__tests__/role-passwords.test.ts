import { EventRole } from "@/lib/types";
import {
  getRolePasswordMinLength,
  isPasswordJoinableRole,
  PASSWORD_REQUIRED_ROLES,
  validateRolePassword,
} from "../role-passwords";
import { isApprovableRole } from "../approval-requests";

describe("role password rules (ORG-013, MENT-017)", () => {
  it("never allows organizer or admin to be joined by password", () => {
    expect(isPasswordJoinableRole(EventRole.Organizer)).toBe(false);
    expect(isPasswordJoinableRole(EventRole.Admin)).toBe(false);
    expect(isPasswordJoinableRole(EventRole.Mentor)).toBe(true);
  });

  it("requires a password for staff roles", () => {
    expect(PASSWORD_REQUIRED_ROLES).toEqual(expect.arrayContaining([EventRole.Mentor, EventRole.Judge]));
  });

  it("enforces minimum and maximum lengths", () => {
    expect(getRolePasswordMinLength(EventRole.Judge)).toBe(12);
    expect(getRolePasswordMinLength(EventRole.Participant)).toBe(8);
    expect(validateRolePassword(EventRole.Judge, "a")).toMatch(/at least 12/);
    expect(validateRolePassword(EventRole.Judge, "a".repeat(12))).toBeNull();
    expect(validateRolePassword(EventRole.Participant, "a".repeat(7))).toMatch(/at least 8/);
    expect(validateRolePassword(EventRole.Participant, "é".repeat(40))).toMatch(/at most 72/);
  });
});

describe("approval request roles (ORG-017)", () => {
  it("only participant requests are approvable", () => {
    expect(isApprovableRole(EventRole.Participant)).toBe(true);
    for (const role of [EventRole.Mentor, EventRole.Judge, EventRole.Organizer, EventRole.Admin]) {
      expect(isApprovableRole(role)).toBe(false);
    }
  });
});
