import {
  buildArtifactsFromLegacy,
  coerceSubmissionAnswerValue,
  deriveLegacySubmissionFieldsFromArtifacts,
  isMultiValueSubmissionFieldType,
  normalizeProjectArtifacts,
} from "./submission";

describe("submission adapters", () => {
  it("normalizes artifacts and enforces one primary per kind", () => {
    const artifacts = normalizeProjectArtifacts([
      {
        kind: "project_link",
        label: "Repo",
        url: "https://github.com/org/repo",
      },
      {
        kind: "project_link",
        label: "Live",
        url: "https://example.com",
        is_primary: true,
      },
      {
        kind: "project_link",
        label: "Docs",
        url: "https://docs.example.com",
        is_primary: true,
      },
    ]);

    expect(artifacts).toHaveLength(3);
    expect(artifacts.filter((item) => item.kind === "project_link")).toHaveLength(
      3
    );
    expect(
      artifacts.filter((item) => item.kind === "project_link" && item.is_primary)
    ).toHaveLength(1);
    expect(artifacts.map((item) => item.sort_order)).toEqual([0, 1, 2]);
  });

  it("keeps multiple artifacts of the same kind even if urls are non-http", () => {
    const artifacts = normalizeProjectArtifacts([
      {
        kind: "project_link",
        label: "Repo",
        url: "github.com/org/repo",
      },
      {
        kind: "project_link",
        label: "Live",
        url: "demo.local/path",
      },
      {
        kind: "project_link",
        label: "Docs",
        url: "docs.local",
      },
    ]);

    expect(artifacts).toHaveLength(3);
    expect(artifacts.filter((item) => item.kind === "project_link")).toHaveLength(
      3
    );
    expect(artifacts.map((item) => item.sort_order)).toEqual([0, 1, 2]);
    expect(artifacts.filter((item) => item.is_primary)).toHaveLength(1);
  });

  it("derives legacy fields from canonical artifacts", () => {
    const artifacts = normalizeProjectArtifacts([
      {
        kind: "project_link",
        label: "Live",
        url: "https://example.com",
        is_primary: true,
      },
      {
        kind: "video_link",
        label: "Demo",
        url: "https://youtube.com/watch?v=demo",
      },
      {
        kind: "additional_material",
        label: "Deck",
        url: "https://drive.google.com/deck",
      },
    ]);

    const legacy = deriveLegacySubmissionFieldsFromArtifacts(artifacts);
    expect(legacy.project_url).toBe("https://example.com");
    expect(legacy.video_url).toBe("https://youtube.com/watch?v=demo");
    expect(legacy.additional_materials_url).toBe("https://drive.google.com/deck");
  });

  it("builds fallback canonical artifacts from legacy fields", () => {
    const artifacts = buildArtifactsFromLegacy({
      project_url: "https://github.com/org/repo",
      video_url: null,
      additional_materials_url: "https://example.com/deck.pdf",
    });

    expect(artifacts).toEqual([
      {
        kind: "project_link",
        label: "Project Link",
        url: "https://github.com/org/repo",
        sort_order: 0,
        is_primary: true,
        metadata: null,
      },
      {
        kind: "additional_material",
        label: "Additional Material",
        url: "https://example.com/deck.pdf",
        sort_order: 0,
        is_primary: true,
        metadata: null,
      },
    ]);
  });

  it("coerces answers by field type", () => {
    expect(coerceSubmissionAnswerValue("short_text", "  hello ")).toBe("hello");
    expect(coerceSubmissionAnswerValue("short_text", 42)).toBeNull();
    expect(
      coerceSubmissionAnswerValue("multi_select", [
        " Next.js ",
        "",
        "Supabase",
      ])
    ).toEqual(["Next.js", "Supabase"]);
    expect(coerceSubmissionAnswerValue("checkbox", true)).toBe("true");
    expect(coerceSubmissionAnswerValue("checkbox", false)).toBe("");
    expect(coerceSubmissionAnswerValue("checkbox", "true")).toBe("true");
    expect(
      coerceSubmissionAnswerValue("multi_url", [
        " https://one.example ",
        " ",
        "https://two.example",
      ])
    ).toEqual(["https://one.example", "https://two.example"]);
    expect(coerceSubmissionAnswerValue("multi_url", "oops")).toEqual([]);
    expect(
      coerceSubmissionAnswerValue("multi_file", [
        " https://cdn.example/a.png ",
        "",
        "https://cdn.example/b.pdf",
      ])
    ).toEqual(["https://cdn.example/a.png", "https://cdn.example/b.pdf"]);
    expect(coerceSubmissionAnswerValue("multi_file", "oops")).toEqual([]);
  });

  it("identifies multi-value field types", () => {
    expect(isMultiValueSubmissionFieldType("multi_url")).toBe(true);
    expect(isMultiValueSubmissionFieldType("multi_select")).toBe(true);
    expect(isMultiValueSubmissionFieldType("multi_file")).toBe(true);
    expect(isMultiValueSubmissionFieldType("file")).toBe(false);
    expect(isMultiValueSubmissionFieldType("url")).toBe(false);
    expect(isMultiValueSubmissionFieldType("short_text")).toBe(false);
  });
});
