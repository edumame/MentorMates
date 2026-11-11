import { EventRole } from "@/lib/types";
import {
  describeRemoval,
  describeRoleChange,
  getAssignableRoles,
  getRowLockReason,
} from "./people-access";

const organizer = { currentUserId: "me", isAdmin: false };
const admin = { currentUserId: "me", isAdmin: true };

describe("People tab row permissions (ORG-009, EVT-ORG-001)", () => {
  it("locks the viewer's own row", () => {
    expect(getRowLockReason({ user_id: "me", role: EventRole.Organizer }, organizer)).toBe("self");
  });
  it("locks other organizers and admins for non-admins", () => {
    expect(getRowLockReason({ user_id: "b", role: EventRole.Organizer }, organizer)).toBe("staff");
    expect(getRowLockReason({ user_id: "c", role: EventRole.Admin }, organizer)).toBe("staff");
  });
  it("leaves participants/judges editable and admins unrestricted", () => {
    expect(getRowLockReason({ user_id: "p", role: EventRole.Judge }, organizer)).toBeNull();
    expect(getRowLockReason({ user_id: "b", role: EventRole.Organizer }, admin)).toBeNull();
  });
  it("locks project-only rows", () => {
    expect(getRowLockReason({ user_id: "project-lead-x", role: EventRole.Participant }, admin)).toBe("project");
  });
  it("only offers the organizer role to admins", () => {
    expect(getAssignableRoles(organizer)).not.toContain(EventRole.Organizer);
    expect(getAssignableRoles(admin)).toContain(EventRole.Organizer);
  });
});

describe("confirmation copy (ORG-008, JUDGE-017)", () => {
  it("mentions team and approval cleanup on removal", () => {
    const lines = describeRemoval({ user_id: "p", role: EventRole.Participant });
    expect(lines.join(" ")).toMatch(/team/);
    expect(lines.join(" ")).toMatch(/approval/);
  });
  it("includes the judge score count when known", () => {
    expect(describeRemoval({ user_id: "j", role: EventRole.Judge }, 3).join(" ")).toMatch(/3 scores/);
    expect(describeRoleChange({ user_id: "j", role: EventRole.Judge }, EventRole.Participant, 1)?.join(" ")).toMatch(/1 score;/);
  });
  it("needs no confirmation for participant role changes", () => {
    expect(describeRoleChange({ user_id: "p", role: EventRole.Participant }, EventRole.Mentor)).toBeNull();
    expect(describeRoleChange({ user_id: "p", role: EventRole.Participant }, EventRole.Judge)).toBeNull();
  });
  it("warns that mentoring assignments are removed when a mentor is removed", () => {
    const text = describeRemoval({ user_id: "m", role: EventRole.Mentor }).join(" ");
    expect(text).toMatch(/mentoring assignments are removed/);
    expect(text).not.toMatch(/judging/);
  });
  it("warns that mentoring assignments are removed when a mentor changes role", () => {
    for (const newRole of [EventRole.Participant, EventRole.Judge, EventRole.Organizer]) {
      const lines = describeRoleChange({ user_id: "m", role: EventRole.Mentor }, newRole);
      expect(lines?.join(" ")).toMatch(/mentoring assignments are removed/);
      expect(lines?.join(" ")).not.toMatch(/score/);
    }
  });
  it("needs no confirmation when the role does not change", () => {
    expect(describeRoleChange({ user_id: "m", role: EventRole.Mentor }, EventRole.Mentor)).toBeNull();
    expect(describeRoleChange({ user_id: "j", role: EventRole.Judge }, EventRole.Judge)).toBeNull();
  });
  it("does not mention mentoring when a judge is removed", () => {
    expect(describeRemoval({ user_id: "j", role: EventRole.Judge }).join(" ")).not.toMatch(/mentoring/);
  });
});
