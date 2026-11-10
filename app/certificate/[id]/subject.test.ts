import { pickCertificateSubject } from "./subject";
import type { ProjectTeamMember } from "@/lib/types";

const members: ProjectTeamMember[] = [
  { id: "lead", display_name: "Lead", avatar_url: null, affiliation: null, role: "lead" },
  { id: "mate", display_name: "Mate", avatar_url: null, affiliation: null, role: "member" },
  { id: null, display_name: "Team member", avatar_url: null, affiliation: null, role: "member" },
];

describe("pickCertificateSubject", () => {
  it("prefers the pinned member", () => {
    expect(pickCertificateSubject(members, "mate", "lead")).toEqual({ id: "mate", name: "Mate" });
  });
  it("falls back to the signed-in team member", () => {
    expect(pickCertificateSubject(members, "unknown", "mate")).toEqual({ id: "mate", name: "Mate" });
  });
  it("falls back to the lead for outsiders", () => {
    expect(pickCertificateSubject(members, null, "outsider")).toEqual({ id: "lead", name: "Lead" });
  });
  it("returns null without a roster", () => {
    expect(pickCertificateSubject([], "mate", null)).toBeNull();
  });
});
