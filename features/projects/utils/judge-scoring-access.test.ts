import { EventRole } from "@/lib/types";
import { canShowProjectScoring } from "./judge-scoring-access";

describe("canShowProjectScoring", () => {
  it.each([
    [EventRole.Judge, true, true],
    [EventRole.Judge, false, false],
    [EventRole.Organizer, false, true],
    [EventRole.Admin, false, true],
    [EventRole.Participant, true, false],
    [EventRole.Mentor, true, false],
    [null, true, false],
  ])("role %s with assignment=%s -> %s", (role, assigned, expected) => {
    expect(canShowProjectScoring(role as EventRole | null, assigned)).toBe(expected);
  });
});
