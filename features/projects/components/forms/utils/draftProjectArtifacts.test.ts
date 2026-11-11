import {
  buildDraftArtifactsPayload,
  getInitialAdditionalMaterialUrls,
  hasDraftUrlListChanged,
  normalizeDraftUrls,
  resolveDraftPrimaryUrl,
  splitPrimaryAndExtrasFromArtifacts,
} from "@/features/projects/components/forms/utils/draftProjectArtifacts";

describe("draft project artifact helpers", () => {
  it("keeps the saved column URL over a stale primary artifact", () => {
    expect(resolveDraftPrimaryUrl("https://new.example", "https://old.example")).toBe(
      "https://new.example"
    );
  });

  it("falls back to the primary artifact when no column URL is saved", () => {
    expect(resolveDraftPrimaryUrl("", "https://artifact.example")).toBe("https://artifact.example");
    expect(resolveDraftPrimaryUrl(null, "https://artifact.example")).toBe("https://artifact.example");
  });

  it("builds payload with primary and extra links for every artifact kind", () => {
    const artifacts = buildDraftArtifactsPayload({
      projectUrl: " https://project-primary.example ",
      videoUrl: "https://video-primary.example",
      additionalMaterialsUrl: "",
      extraProjectUrls: [" https://project-extra-1.example ", ""],
      extraVideoUrls: ["", "https://video-extra-2.example"],
      extraMaterialsUrls: ["https://materials-extra-1.example"],
    });

    expect(artifacts).toEqual([
      {
        kind: "project_link",
        label: "Project Link",
        url: "https://project-primary.example",
        sort_order: 0,
        is_primary: true,
      },
      {
        kind: "project_link",
        label: "Project Link 2",
        url: "https://project-extra-1.example",
        sort_order: 1,
        is_primary: false,
      },
      {
        kind: "video_link",
        label: "Video Link",
        url: "https://video-primary.example",
        sort_order: 0,
        is_primary: true,
      },
      {
        kind: "video_link",
        label: "Video Link 2",
        url: "https://video-extra-2.example",
        sort_order: 1,
        is_primary: false,
      },
      {
        kind: "additional_material",
        label: "Additional Material",
        url: "https://materials-extra-1.example",
        sort_order: 0,
        is_primary: true,
      },
    ]);
  });

  it("hydrates primary and extra links from artifact rows", () => {
    const hydrated = splitPrimaryAndExtrasFromArtifacts([
      {
        url: "https://video-2.example",
        sort_order: 1,
        is_primary: false,
      },
      {
        url: "https://video-primary.example",
        sort_order: 0,
        is_primary: true,
      },
      {
        url: "https://video-3.example",
        sort_order: 2,
        is_primary: false,
      },
    ]);

    expect(hydrated).toEqual({
      primaryUrl: "https://video-primary.example",
      extraUrls: ["https://video-2.example", "https://video-3.example"],
    });
  });

  it("falls back to first sorted link as primary when no primary is marked", () => {
    const hydrated = splitPrimaryAndExtrasFromArtifacts([
      {
        url: "https://project-2.example",
        sort_order: 1,
        is_primary: false,
      },
      {
        url: "https://project-1.example",
        sort_order: 0,
        is_primary: false,
      },
    ]);

    expect(hydrated).toEqual({
      primaryUrl: "https://project-1.example",
      extraUrls: ["https://project-2.example"],
    });
  });

  it("normalizes url lists and detects extra-link changes", () => {
    expect(normalizeDraftUrls(["  https://a.example ", "", "  "])).toEqual([
      "https://a.example",
    ]);

    expect(
      hasDraftUrlListChanged([" https://a.example ", ""], ["https://a.example"])
    ).toBe(false);
    expect(
      hasDraftUrlListChanged(
        ["https://a.example", "https://b.example"],
        ["https://a.example"]
      )
    ).toBe(true);
  });
});

describe("getInitialAdditionalMaterialUrls", () => {
  const urls = ["https://one.example", "https://two.example", "https://three.example"];

  it("returns every saved value for a configured multi-value field", () => {
    expect(
      getInitialAdditionalMaterialUrls({
        has_submission_field_config: true,
        additional_materials_url: urls[0],
        submission_values: { additional_materials: urls },
      })
    ).toEqual(urls);
  });

  it("wraps a configured single-value field", () => {
    expect(
      getInitialAdditionalMaterialUrls({
        has_submission_field_config: true,
        additional_materials_url: urls[0],
        submission_values: { additional_materials: urls[0] },
      })
    ).toEqual([urls[0]]);
  });

  it("stays empty when a configured field has no saved value", () => {
    expect(
      getInitialAdditionalMaterialUrls({
        has_submission_field_config: true,
        additional_materials_url: "",
        submission_values: { additional_materials: [] },
      })
    ).toEqual([]);
  });

  it("falls back to the scalar when a configured event omits the field", () => {
    expect(
      getInitialAdditionalMaterialUrls({
        has_submission_field_config: true,
        additional_materials_url: urls[0],
        submission_values: {},
      })
    ).toEqual([urls[0]]);
  });

  it("ignores submission values on unconfigured events, which hydrate from artifacts", () => {
    expect(
      getInitialAdditionalMaterialUrls({
        has_submission_field_config: false,
        additional_materials_url: urls[0],
        submission_values: { additional_materials: urls },
      })
    ).toEqual([urls[0]]);
  });

  it("handles a project with no additional materials data", () => {
    expect(getInitialAdditionalMaterialUrls({})).toEqual([]);
  });
});
