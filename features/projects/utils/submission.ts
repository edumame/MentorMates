import { z } from "zod";

export const PROJECT_ARTIFACT_KINDS = [
  "project_link",
  "video_link",
  "additional_material",
] as const;

export type ProjectArtifactKind = (typeof PROJECT_ARTIFACT_KINDS)[number];

export type ProjectArtifactInput = {
  id?: string;
  kind: ProjectArtifactKind;
  label?: string;
  url: string;
  sort_order?: number;
  is_primary?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type ProjectArtifactRecord = {
  id?: string;
  project_id?: string;
  kind: ProjectArtifactKind;
  label: string;
  url: string;
  sort_order: number;
  is_primary: boolean;
  metadata: Record<string, unknown> | null;
};

const artifactInputSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(PROJECT_ARTIFACT_KINDS),
  label: z.string().optional(),
  url: z.string().trim().min(1),
  sort_order: z.number().int().nonnegative().optional(),
  is_primary: z.boolean().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const submissionFieldTypeSchema = z.enum([
  "short_text",
  "long_text",
  "url",
  "multi_url",
]);

export type SubmissionFieldType = z.infer<typeof submissionFieldTypeSchema>;

export const submissionAnswerInputSchema = z.object({
  eventSubmissionFieldId: z.string().uuid(),
  answer: z.union([z.string(), z.array(z.string())]),
});

export type SubmissionAnswerInput = z.infer<typeof submissionAnswerInputSchema>;

type LegacySubmissionFields = {
  project_url?: string | null;
  video_url?: string | null;
  additional_materials_url?: string | null;
};

const defaultLabelByKind: Record<ProjectArtifactKind, string> = {
  project_link: "Project Link",
  video_link: "Video Link",
  additional_material: "Additional Material",
};

const kindPriority: Record<ProjectArtifactKind, number> = {
  project_link: 0,
  video_link: 1,
  additional_material: 2,
};

export function normalizeProjectArtifacts(
  input: unknown
): ProjectArtifactRecord[] {
  if (!Array.isArray(input)) return [];

  const parsed = input
    .map((item) => artifactInputSchema.safeParse(item))
    .filter((item) => item.success)
    .map((item) => item.data)
    .filter((item) => item.url.trim().length > 0);

  const byKind: Record<ProjectArtifactKind, ProjectArtifactRecord[]> = {
    project_link: [],
    video_link: [],
    additional_material: [],
  };

  parsed.forEach((artifact) => {
    byKind[artifact.kind].push({
      id: artifact.id,
      kind: artifact.kind,
      label: artifact.label?.trim() || defaultLabelByKind[artifact.kind],
      url: artifact.url.trim(),
      sort_order: artifact.sort_order ?? 0,
      is_primary: Boolean(artifact.is_primary),
      metadata: artifact.metadata ?? null,
    });
  });

  const normalized: ProjectArtifactRecord[] = [];

  for (const kind of PROJECT_ARTIFACT_KINDS) {
    const entries = byKind[kind]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((entry, index) => ({
        ...entry,
        sort_order: index,
      }));

    if (entries.length > 0 && !entries.some((entry) => entry.is_primary)) {
      entries[0].is_primary = true;
    }

    // Keep only first "primary" flag if multiple were provided.
    let primarySeen = false;
    for (const entry of entries) {
      if (entry.is_primary && !primarySeen) {
        primarySeen = true;
      } else if (entry.is_primary && primarySeen) {
        entry.is_primary = false;
      }
      normalized.push(entry);
    }
  }

  return normalized.sort((a, b) => {
    const kindCmp = kindPriority[a.kind] - kindPriority[b.kind];
    if (kindCmp !== 0) return kindCmp;
    return a.sort_order - b.sort_order;
  });
}

export function buildArtifactsFromLegacy(
  legacy: LegacySubmissionFields
): ProjectArtifactRecord[] {
  const artifacts: ProjectArtifactRecord[] = [];

  if (legacy.project_url?.trim()) {
    artifacts.push({
      kind: "project_link",
      label: defaultLabelByKind.project_link,
      url: legacy.project_url.trim(),
      sort_order: 0,
      is_primary: true,
      metadata: null,
    });
  }
  if (legacy.video_url?.trim()) {
    artifacts.push({
      kind: "video_link",
      label: defaultLabelByKind.video_link,
      url: legacy.video_url.trim(),
      sort_order: 0,
      is_primary: true,
      metadata: null,
    });
  }
  if (legacy.additional_materials_url?.trim()) {
    artifacts.push({
      kind: "additional_material",
      label: defaultLabelByKind.additional_material,
      url: legacy.additional_materials_url.trim(),
      sort_order: 0,
      is_primary: true,
      metadata: null,
    });
  }

  return artifacts;
}

export function deriveLegacySubmissionFieldsFromArtifacts(
  artifacts: ProjectArtifactRecord[]
): {
  project_url: string | null;
  video_url: string | null;
  additional_materials_url: string | null;
} {
  const pick = (kind: ProjectArtifactKind) => {
    const matching = artifacts.filter((artifact) => artifact.kind === kind);
    if (matching.length === 0) return null;
    return (
      matching.find((artifact) => artifact.is_primary)?.url ||
      matching[0]?.url ||
      null
    );
  };

  return {
    project_url: pick("project_link"),
    video_url: pick("video_link"),
    additional_materials_url: pick("additional_material"),
  };
}

export function coerceSubmissionAnswerValue(
  fieldType: SubmissionFieldType,
  value: unknown
): string | string[] | null {
  if (fieldType === "multi_url") {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }

  if (typeof value !== "string") return null;
  return value.trim();
}
