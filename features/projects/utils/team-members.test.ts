import { buildTeamMembers } from "./team-members";

const project = {
  lead_name: "Lea Lead",
  lead_email: "Lead@Example.com",
  teammates: ["Mate@Example.com", "ghost@example.com"],
};

const profile = (display_name: string | null) => ({
  display_name,
  avatar_url: null,
  affiliation: null,
});

describe("buildTeamMembers", () => {
  it("names members from team_profiles by lowercased email", () => {
    const members = buildTeamMembers({
      ...project,
      team_profiles: {
        "lead@example.com": profile("Profile Lead"),
        "mate@example.com": profile("Mia Mate"),
      },
    });

    expect(members).toEqual([
      { email: "Lead@Example.com", displayName: "Profile Lead", role: "lead" },
      { email: "Mate@Example.com", displayName: "Mia Mate", role: "member" },
      { email: "ghost@example.com", displayName: "ghost@example.com", role: "member" },
    ]);
  });

  it("falls back to lead_name and the email without profiles", () => {
    const members = buildTeamMembers(project);

    expect(members.map((member) => member.displayName)).toEqual([
      "Lea Lead",
      "Mate@Example.com",
      "ghost@example.com",
    ]);
  });

  it("prefers the profile name, then fallbackName, for teammates", () => {
    const fallbackName = (email: string) =>
      email === "ghost@example.com" ? "Search Result" : "Unused";

    const members = buildTeamMembers(
      {
        ...project,
        team_profiles: {
          "mate@example.com": profile("Mia Mate"),
          "ghost@example.com": profile(null),
        },
      },
      fallbackName
    );

    expect(members.map((member) => member.displayName)).toEqual([
      "Lea Lead",
      "Mia Mate",
      "Search Result",
    ]);
  });

  it("handles a project with no teammates", () => {
    expect(buildTeamMembers({ ...project, teammates: undefined })).toHaveLength(1);
  });
});
