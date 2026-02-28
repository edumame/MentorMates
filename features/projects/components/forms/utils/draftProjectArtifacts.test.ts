import {
  buildDraftArtifactsPayload,
  hasDraftUrlListChanged,
  normalizeDraftUrls,
  splitPrimaryAndExtrasFromArtifacts,
} from "@/features/projects/components/forms/utils/draftProjectArtifacts";

describe("draft project artifact helpers", () => {
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

