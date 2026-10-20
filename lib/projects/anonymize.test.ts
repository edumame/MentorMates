import {
  redactAnonymizedProject,
  redactAnonymizedProjects,
} from "@/lib/projects/anonymize";

describe("redactAnonymizedProject", () => {
  const sample = {
    id: "p1",
    project_name: "Cool Thing",
    lead_name: "Jane Doe",
    lead_email: "jane@example.com",
    created_by: "user-id-123",
    owner_id: "user-id-123",
    cover_image_url: "https://cdn.example.com/jane.png",
    teammates: ["jane@example.com", "bob@example.com"],
    team_members: [
      { name: "Bob", email: "bob@example.com", avatar_url: "https://x/b.png" },
    ],
    teammate_profiles: [{ email: "bob@example.com", display_name: "Bob" }],
  };

  it("returns the project unchanged when viewer is organizer/admin", () => {
    const out = redactAnonymizedProject(sample, true);
    expect(out).toEqual(sample);
    // Same reference is fine — we promise no-op for organizers.
    expect(out.lead_name).toBe("Jane Doe");
    expect(out.lead_email).toBe("jane@example.com");
  });

  it("replaces lead_name with 'Anonymous' when viewer is not organizer/admin", () => {
    const out = redactAnonymizedProject(sample, false);
    expect(out.lead_name).toBe("Anonymous");
    expect(out.lead_email).toBeNull();
    expect(out.created_by).toBeNull();
    expect(out.owner_id).toBeNull();
  });

  it("clears teammate emails and avatars when viewer is not organizer/admin", () => {
    const out = redactAnonymizedProject(sample, false);
    // Email-string teammates get dropped entirely (emails are PII).
    expect(out.teammates).toEqual([]);
    // Object team_members get name swapped + avatar cleared.
    expect(out.team_members).toEqual([
      {
        name: "Anonymous",
        display_name: "Anonymous",
        email: null,
        avatar_url: null,
      },
    ]);
    expect(out.teammate_profiles).toEqual([]);
    expect(out.cover_image_url).toBeNull();
  });

  it("preserves non-identity fields when redacting", () => {
    const out = redactAnonymizedProject(sample, false);
    expect(out.id).toBe("p1");
    expect(out.project_name).toBe("Cool Thing");
  });
});

describe("redactAnonymizedProjects", () => {
  it("maps over a list and redacts each entry", () => {
    const list = [
      { id: "a", lead_name: "Alice", lead_email: "a@x.com" },
      { id: "b", lead_name: "Bob", lead_email: "b@x.com" },
    ];
    const out = redactAnonymizedProjects(list, false);
    expect(out).toHaveLength(2);
    expect(out[0].lead_name).toBe("Anonymous");
    expect(out[1].lead_name).toBe("Anonymous");
    expect(out[0].lead_email).toBeNull();
  });

  it("is a no-op when viewer is organizer/admin", () => {
    const list = [{ id: "a", lead_name: "Alice", lead_email: "a@x.com" }];
    const out = redactAnonymizedProjects(list, true);
    expect(out[0].lead_name).toBe("Alice");
    expect(out[0].lead_email).toBe("a@x.com");
  });
});
