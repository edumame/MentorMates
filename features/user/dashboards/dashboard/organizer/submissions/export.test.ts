import { buildSubmissionExportRows } from "./export";

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
        "Lead Email": "alice@example.com",
        Description: "AI workflow builder",
        "Primary Project URL": "https://demo.example.com",
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
        "Deployment Links":
          "https://vibeflow.app | https://staging.vibeflow.app",
        "GitHub Link": "https://github.com/acme/vibeflow",
      },
    ]);
  });
});
