import {
  buildSubmissionExportRows,
  type SubmissionExportProject,
} from "./export";

function makeProject(
  overrides: Partial<SubmissionExportProject> = {}
): SubmissionExportProject {
  return {
    project_name: "Project A",
    lead_name: "Ada Lovelace",
    lead_email: "ada@example.com",
    project_description: "An example",
    teammates: [],
    project_url: null,
    additional_materials_url: null,
    cover_image_url: null,
    created_at: "2026-03-01T00:00:00.000Z",
    submitted: true,
    project_tracks: [],
    artifacts: [],
    submission_fields: [],
    submission_values: {},
    ...overrides,
  };
}

describe("buildSubmissionExportRows", () => {
  it("includes artifact links and custom submission answers in organizer exports", () => {
    const rows = buildSubmissionExportRows([
      {
        project_name: "Vibeflow",
        lead_name: "Alice",
        lead_email: "alice@example.com",
        project_description: "AI workflow builder",
        project_url: "https://demo.example.com",
        additional_materials_url: "https://drive.example.com/deck.pdf",
        cover_image_url: "https://cdn.example.com/cover.png",
        teammates: ["bob@example.com", "carol@example.com"],
        created_at: "2026-03-18T00:00:00Z",
        submitted: true,
        project_tracks: [
          {
            event_tracks: {
              name: "Best AI App",
            },
          },
        ],
        artifacts: [
          {
            kind: "project_link",
            label: "GitHub Repo",
            url: "https://github.com/acme/vibeflow",
            is_primary: true,
          },
          {
            kind: "project_link",
            label: "Deployed App",
            url: "https://vibeflow.app",
          },
          {
            kind: "additional_material",
            label: "Pitch Deck",
            url: "https://drive.example.com/deck.pdf",
          },
        ],
        submission_fields: [
          { key: "project_name", label: "Project Name" },
          { key: "project_url", label: "Project URL" },
          { key: "github_link", label: "GitHub Link" },
          { key: "deployment_links", label: "Deployment Links" },
        ],
        submission_values: {
          project_name: "Vibeflow",
          project_url: "https://demo.example.com",
          github_link: "https://github.com/acme/vibeflow",
          deployment_links: [
            "https://vibeflow.app",
            "https://staging.vibeflow.app",
          ],
        },
      },
    ]);

    expect(rows).toEqual([
      {
        "Project Name": "Vibeflow",
        "Lead Name": "Alice",
        "Lead First Name": "Alice",
        "Lead Last Name": "",
        "Lead Email": "alice@example.com",
        "Lead School": "",
        Description: "AI workflow builder",
        "Primary Project URL": "https://demo.example.com",
        "GitHub URL": "https://github.com/acme/vibeflow",
        "All Project Links":
          "https://github.com/acme/vibeflow | https://vibeflow.app",
        "Video Links": "",
        "Additional Material Links": "https://drive.example.com/deck.pdf",
        "Cover Image URL": "https://cdn.example.com/cover.png",
        "All Submission Artifacts":
          "GitHub Repo: https://github.com/acme/vibeflow | Deployed App: https://vibeflow.app | Pitch Deck: https://drive.example.com/deck.pdf",
        "Team Members": "bob@example.com, carol@example.com",
        Tracks: "Best AI App",
        Submitted: true,
        "Created At": "2026-03-18T00:00:00Z",
        // Per-member columns (no teammate_profiles provided → empty profile data)
        "Member 1 First Name": "",
        "Member 1 Last Name": "",
        "Member 1 Email": "bob@example.com",
        "Member 1 School": "",
        "Member 2 First Name": "",
        "Member 2 Last Name": "",
        "Member 2 Email": "carol@example.com",
        "Member 2 School": "",
        // Custom field columns follow schema (first-seen) order, not alphabetical.
        // project_name / project_url collide with built-in keys and are skipped.
        "GitHub Link": "https://github.com/acme/vibeflow",
        "Deployment Links":
          "https://vibeflow.app | https://staging.vibeflow.app",
      },
    ]);
  });

  // MLH-compliance regression tests. MentorMates must stay compatible with the
  // MLH Hackathon Submission Portal requirements so MLH-affiliated organizers
  // can use MM instead of Devpost. See:
  // https://guide.mlh.io/general-information/judging-and-submissions/hackathon-submission-portal
  describe("MLH submission portal compatibility", () => {
    it("emits every MLH-required base column", () => {
      const [row] = buildSubmissionExportRows([makeProject()]);
      const headers = Object.keys(row);

      expect(headers).toEqual(
        expect.arrayContaining([
          "Project Name",
          "Lead Name",
          "Lead Email",
          "Description",
          "Primary Project URL",
          "GitHub URL",
          "Team Members",
          "Tracks",
          "Submitted",
          "Created At",
        ])
      );
    });

    it("extracts GitHub URLs from project_link artifacts into a dedicated column", () => {
      const [row] = buildSubmissionExportRows([
        makeProject({
          artifacts: [
            { kind: "project_link", url: "https://demo.example.com" },
            { kind: "project_link", url: "https://github.com/acme/repo" },
            { kind: "video_link", url: "https://youtu.be/xyz" },
          ],
        }),
      ]);

      expect(row["GitHub URL"]).toBe("https://github.com/acme/repo");
      expect(row["All Project Links"]).toContain("https://demo.example.com");
      expect(row["All Project Links"]).toContain("https://github.com/acme/repo");
    });

    it("returns empty GitHub URL when no GitHub artifact is present", () => {
      const [row] = buildSubmissionExportRows([
        makeProject({
          artifacts: [
            { kind: "project_link", url: "https://demo.example.com" },
          ],
        }),
      ]);
      expect(row["GitHub URL"]).toBe("");
    });

    it("joins multiple GitHub URLs with the pipe delimiter", () => {
      const [row] = buildSubmissionExportRows([
        makeProject({
          artifacts: [
            { kind: "project_link", url: "https://github.com/org/frontend" },
            { kind: "project_link", url: "https://github.com/org/backend" },
          ],
        }),
      ]);
      expect(row["GitHub URL"]).toBe(
        "https://github.com/org/frontend | https://github.com/org/backend"
      );
    });

    it("does not false-match github on lookalike domains", () => {
      const [row] = buildSubmissionExportRows([
        makeProject({
          artifacts: [
            { kind: "project_link", url: "https://notgithub.com/foo" },
            { kind: "project_link", url: "https://github.com.evil.example/foo" },
          ],
        }),
      ]);
      expect(row["GitHub URL"]).toBe("");
    });

    it("preserves first-seen custom field order for stable MLH exports", () => {
      // An MLH-compliant submission form defines fields in this order:
      //   Built With -> GenAI Tools Used -> GenAI Description.
      // Adding a new field for a later project must append at the end, not
      // reshuffle existing columns (downstream MLH imports depend on order).
      const rows = buildSubmissionExportRows([
        makeProject({
          project_name: "P1",
          submission_fields: [
            { key: "mlh_built_with", label: "Built With" },
            { key: "mlh_genai_tools", label: "GenAI Tools Used" },
            { key: "mlh_genai_description", label: "GenAI Description" },
          ],
          submission_values: {
            mlh_built_with: "Next.js, Supabase",
            mlh_genai_tools: ["Anthropic", "OpenAI"],
            mlh_genai_description: "Used for prompt chaining",
          },
        }),
        makeProject({
          project_name: "P2",
          submission_fields: [
            { key: "mlh_built_with", label: "Built With" },
            { key: "mlh_genai_tools", label: "GenAI Tools Used" },
            { key: "mlh_genai_description", label: "GenAI Description" },
            { key: "tweet_handle", label: "Twitter Handle" },
          ],
          submission_values: {
            mlh_built_with: "Rust",
            mlh_genai_tools: [],
            mlh_genai_description: "N/A",
            tweet_handle: "@p2team",
          },
        }),
      ]);

      const headers = Object.keys(rows[0]);
      const customHeaderOrder = headers.filter((header) =>
        [
          "Built With",
          "GenAI Tools Used",
          "GenAI Description",
          "Twitter Handle",
        ].includes(header)
      );
      expect(customHeaderOrder).toEqual([
        "Built With",
        "GenAI Tools Used",
        "GenAI Description",
        "Twitter Handle",
      ]);

      // Array values are pipe-joined.
      expect(rows[0]["GenAI Tools Used"]).toBe("Anthropic | OpenAI");
      // Empty array renders blank; organizers can still post-process to "N/A".
      expect(rows[1]["GenAI Tools Used"]).toBe("");
    });

    it("disambiguates duplicate custom field labels by appending the key", () => {
      const [row] = buildSubmissionExportRows([
        makeProject({
          submission_fields: [
            { key: "url_a", label: "Link" },
            { key: "url_b", label: "Link" },
          ],
          submission_values: { url_a: "A", url_b: "B" },
        }),
      ]);
      expect(row["Link (url_a)"]).toBe("A");
      expect(row["Link (url_b)"]).toBe("B");
    });

    it("skips custom fields that collide with built-in submission keys", () => {
      const [row] = buildSubmissionExportRows([
        makeProject({
          submission_fields: [
            { key: "project_name", label: "Project Name" },
            { key: "real_custom", label: "Real Custom" },
          ],
          submission_values: {
            project_name: "Should Not Overwrite",
            real_custom: "ok",
          },
        }),
      ]);
      expect(Object.keys(row).filter((k) => k === "Project Name")).toHaveLength(
        1
      );
      expect(row["Project Name"]).toBe("Project A");
      expect(row["Real Custom"]).toBe("ok");
    });

    it("emits Lead First/Last Name and Lead School columns", () => {
      const [row] = buildSubmissionExportRows([
        makeProject({
          lead_name: "Ada Lovelace",
          lead_school: "University of London",
        }),
      ]);
      expect(row["Lead First Name"]).toBe("Ada");
      expect(row["Lead Last Name"]).toBe("Lovelace");
      expect(row["Lead School"]).toBe("University of London");
    });

    it("handles lead with single-word display_name", () => {
      const [row] = buildSubmissionExportRows([
        makeProject({ lead_name: "Alice" }),
      ]);
      expect(row["Lead First Name"]).toBe("Alice");
      expect(row["Lead Last Name"]).toBe("");
    });

    it("expands teammates to per-member columns with profile data", () => {
      const [row] = buildSubmissionExportRows([
        makeProject({
          lead_email: "lead@example.com",
          teammates: ["lead@example.com", "bob@example.com", "carol@example.com"],
          teammate_profiles: [
            {
              email: "bob@example.com",
              display_name: "Bob Smith",
              affiliation: "MIT",
            },
            {
              email: "carol@example.com",
              display_name: "Carol Jones",
              affiliation: "Stanford",
            },
          ],
        }),
      ]);

      // Lead email filtered from non-lead teammates
      expect(row["Member 1 Email"]).toBe("bob@example.com");
      expect(row["Member 1 First Name"]).toBe("Bob");
      expect(row["Member 1 Last Name"]).toBe("Smith");
      expect(row["Member 1 School"]).toBe("MIT");

      expect(row["Member 2 Email"]).toBe("carol@example.com");
      expect(row["Member 2 First Name"]).toBe("Carol");
      expect(row["Member 2 Last Name"]).toBe("Jones");
      expect(row["Member 2 School"]).toBe("Stanford");
    });

    it("falls back to empty strings when teammate profile is missing", () => {
      const [row] = buildSubmissionExportRows([
        makeProject({
          teammates: ["unknown@example.com"],
          teammate_profiles: [],
        }),
      ]);
      expect(row["Member 1 Email"]).toBe("unknown@example.com");
      expect(row["Member 1 First Name"]).toBe("");
      expect(row["Member 1 Last Name"]).toBe("");
      expect(row["Member 1 School"]).toBe("");
    });

    it("pads empty member slots when projects have different team sizes", () => {
      // Two projects: one with 2 teammates, one with 0.
      // The shorter project should still emit Member 1/2 columns (blank).
      const rows = buildSubmissionExportRows([
        makeProject({
          project_name: "Big Team",
          teammates: ["a@example.com", "b@example.com"],
          teammate_profiles: [],
        }),
        makeProject({
          project_name: "Solo",
          teammates: [],
          teammate_profiles: [],
        }),
      ]);

      expect(rows[1]["Member 1 Email"]).toBe("");
      expect(rows[1]["Member 1 First Name"]).toBe("");
      expect(rows[1]["Member 2 Email"]).toBe("");
    });

    it("does not emit member columns when all projects are solo", () => {
      const [row] = buildSubmissionExportRows([makeProject({ teammates: [] })]);
      const headers = Object.keys(row);
      expect(headers.some((h) => h.startsWith("Member "))).toBe(false);
    });
  });
});
