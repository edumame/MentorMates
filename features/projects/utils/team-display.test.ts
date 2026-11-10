import { getProjectTeamDisplayMembers } from "./team-display";
import type { ProjectTeamMember } from "@/lib/types";

const roster: ProjectTeamMember[] = [
  { id: "u1", display_name: "Lead", avatar_url: "a.png", affiliation: "Uni", role: "lead" },
  { id: null, display_name: "Team member", avatar_url: null, affiliation: null, role: "member" },
];

describe("getProjectTeamDisplayMembers", () => {
  it("uses the email-free roster as-is for public payloads", () => {
    const members = getProjectTeamDisplayMembers({ lead_name: "Lead", team_members: roster });
    expect(members.map((m) => [m.displayName, m.role, m.email])).toEqual([
      ["Lead", "lead", null],
      ["Team member", "member", null],
    ]);
    expect(new Set(members.map((m) => m.key)).size).toBe(2);
  });

  it("follows current emails on the private route and borrows profile data by email", () => {
    const members = getProjectTeamDisplayMembers(
      {
        lead_name: "Lead",
        lead_email: "LEAD@x.test",
        teammates: ["new@x.test"],
        team_members: [{ ...roster[0], email: "lead@x.test" }],
      },
      { "new@x.test": "Newly Added" }
    );
    expect(members).toEqual([
      expect.objectContaining({ id: "u1", displayName: "Lead", avatarUrl: "a.png", email: "lead@x.test", role: "lead" }),
      expect.objectContaining({ id: null, displayName: "Newly Added", email: "new@x.test", role: "member" }),
    ]);
  });

  it("never uses an email as a display name when nothing else is known", () => {
    const members = getProjectTeamDisplayMembers({ lead_name: "", lead_email: "l@x.test", teammates: ["m@x.test", "l@x.test"] });
    expect(members.map((m) => m.displayName)).toEqual(["Project lead", "Team member"]);
  });
});
