import {
  buildTeamMembers,
  buildTeamProfileByEmail,
  getInitials,
  getPublicProjectShareUrl,
  getTeamProfileEmails,
  type TeamProfileByEmail,
} from "@/features/projects/utils/team-members";

describe("team-members utils", () => {
  it("builds and normalizes team profile map by email", () => {
    const profileMap = buildTeamProfileByEmail([
      {
        email: " Lead@Example.com ",
        display_name: "  Lead Name ",
        avatar_url: " https://cdn/avatar.png ",
        affiliation: "  Stanford ",
      },
      {
        email: "",
        display_name: "Ignored",
        avatar_url: null,
        affiliation: null,
      },
    ]);

    expect(profileMap).toEqual({
      "lead@example.com": {
        displayName: "Lead Name",
        avatarUrl: "https://cdn/avatar.png",
        affiliation: "Stanford",
      },
    });
  });

  it("returns deduplicated normalized team emails", () => {
    const emails = getTeamProfileEmails({
      lead_name: "Lead",
      lead_email: "LEAD@example.com",
      teammates: ["member@example.com", " lead@example.com ", "", "member@example.com"],
    });

    expect(emails).toEqual(["lead@example.com", "member@example.com"]);
  });

  it("builds team members with profile and participant fallback data", () => {
    const teamProfileByEmail: TeamProfileByEmail = {
      "lead@example.com": {
        displayName: "Lead Profile",
        avatarUrl: "https://cdn/lead.png",
        affiliation: "MIT",
      },
      "member@example.com": {
        displayName: null,
        avatarUrl: null,
        affiliation: null,
      },
    };

    const members = buildTeamMembers(
      {
        lead_name: "Lead DB Name",
        lead_email: "lead@example.com",
        teammates: ["member@example.com", "lead@example.com"],
      },
      teamProfileByEmail,
      [{ email: "member@example.com", display_name: "Participant Name" }]
    );

    expect(members).toEqual([
      {
        email: "lead@example.com",
        displayName: "Lead Profile",
        role: "lead",
        affiliation: "MIT",
        avatarUrl: "https://cdn/lead.png",
        subtitle: "MIT",
      },
      {
        email: "member@example.com",
        displayName: "Participant Name",
        role: "member",
        affiliation: null,
        avatarUrl: null,
        subtitle: null,
      },
    ]);
  });

  it("uses email subtitle when display name falls back to email", () => {
    const members = buildTeamMembers(
      {
        lead_name: "",
        lead_email: "lead@example.com",
        teammates: [],
      },
      {}
    );

    expect(members[0]).toMatchObject({
      displayName: "lead@example.com",
      subtitle: "lead@example.com",
    });
  });

  it("builds canonical public project share URLs", () => {
    expect(getPublicProjectShareUrl("https://example.com", "abc123")).toBe(
      "https://example.com/projects/public/abc123"
    );
    expect(getPublicProjectShareUrl("https://example.com/", "abc123")).toBe(
      "https://example.com/projects/public/abc123"
    );
    expect(getPublicProjectShareUrl("", "abc123")).toBe("/projects/public/abc123");
  });

  it("creates initials from names safely", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
    expect(getInitials("  ")).toBe("?");
    expect(getInitials("solo")).toBe("S");
  });
});
