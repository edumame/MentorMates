export type DraftArtifactKind =
  | "project_link"
  | "video_link"
  | "additional_material";

type DraftArtifactRecord = {
  kind: DraftArtifactKind;
  label: string;
  url: string;
  sort_order: number;
  is_primary: boolean;
};

type ArtifactInputRecord = {
  url?: string | null;
  sort_order?: number | null;
  is_primary?: boolean | null;
};

export function normalizeDraftUrls(urls: string[]): string[] {
  return urls.map((url) => url.trim()).filter((url) => url.length > 0);
}

export function hasDraftUrlListChanged(
  currentUrls: string[],
  savedUrls: string[]
): boolean {
  return JSON.stringify(normalizeDraftUrls(currentUrls)) !== JSON.stringify(savedUrls);
}

function appendDraftArtifacts(
  artifacts: DraftArtifactRecord[],
  kind: DraftArtifactKind,
  primaryUrl: string,
  extras: string[],
  baseLabel: string
) {
  const urls = [primaryUrl, ...extras]
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  urls.forEach((url, index) => {
    artifacts.push({
      kind,
      label: index === 0 ? baseLabel : `${baseLabel} ${index + 1}`,
      url,
      sort_order: index,
      is_primary: index === 0,
    });
  });
}

export function buildDraftArtifactsPayload(params: {
  projectUrl: string;
  videoUrl: string;
  additionalMaterialsUrl: string;
  extraProjectUrls: string[];
  extraVideoUrls: string[];
  extraMaterialsUrls: string[];
}): DraftArtifactRecord[] {
  const artifacts: DraftArtifactRecord[] = [];

  appendDraftArtifacts(
    artifacts,
    "project_link",
    params.projectUrl,
    params.extraProjectUrls,
    "Project Link"
  );
  appendDraftArtifacts(
    artifacts,
    "video_link",
    params.videoUrl,
    params.extraVideoUrls,
    "Video Link"
  );
  appendDraftArtifacts(
    artifacts,
    "additional_material",
    params.additionalMaterialsUrl,
    params.extraMaterialsUrls,
    "Additional Material"
  );

  console.log("artifacts", artifacts);

  return artifacts;
}

// The saved column wins: older inline edits changed it without updating the
// artifact row, and rehydrating that stale row would autosave the old URL back.
export function resolveDraftPrimaryUrl(
  savedUrl: string | null | undefined,
  artifactPrimaryUrl: string
): string {
  return savedUrl?.trim() || artifactPrimaryUrl;
}

// Configured events keep the full list in submission_values; the scalar
// additional_materials_url only mirrors its first item. Other events hydrate
// their extras from project_artifacts after mount.
export function getInitialAdditionalMaterialUrls(project: {
  additional_materials_url?: string | null;
  has_submission_field_config?: boolean;
  submission_values?: Record<string, string | string[]>;
}): string[] {
  const configuredValue = project.has_submission_field_config
    ? project.submission_values?.additional_materials
    : undefined;

  if (configuredValue !== undefined) {
    return normalizeDraftUrls(
      Array.isArray(configuredValue) ? configuredValue : [configuredValue]
    );
  }

  return normalizeDraftUrls([project.additional_materials_url || ""]);
}

export function splitPrimaryAndExtrasFromArtifacts(
  artifacts: ArtifactInputRecord[]
): {
  primaryUrl: string;
  extraUrls: string[];
} {
  const normalized = artifacts
    .map((artifact, index) => ({
      index,
      url: artifact.url?.trim() || "",
      sort_order: artifact.sort_order ?? index,
      is_primary: Boolean(artifact.is_primary),
    }))
    .filter((artifact) => artifact.url.length > 0)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (normalized.length === 0) {
    return { primaryUrl: "", extraUrls: [] };
  }

  const primary = normalized.find((artifact) => artifact.is_primary) ?? normalized[0];
  const primaryUrl = primary.url;
  const extraUrls = normalized
    .filter((artifact) => artifact.index !== primary.index)
    .map((artifact) => artifact.url);

  return {
    primaryUrl,
    extraUrls,
  };
}
