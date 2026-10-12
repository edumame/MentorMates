type SubmissionValue = string | string[];

type ExportArtifact = {
  kind: "project_link" | "video_link" | "additional_material";
  label?: string;
  url: string;
  is_primary?: boolean;
};

type ExportField = {
  key: string;
  label: string;
};

export type ExportMemberProfile = {
  email: string;
  display_name?: string | null;
  affiliation?: string | null;
};

export type SubmissionExportProject = {
  project_name: string;
  lead_name: string;
  lead_email: string;
  lead_school?: string | null;
  project_description: string;
  teammates: string[];
  teammate_profiles?: ExportMemberProfile[];
  project_url?: string | null;
  additional_materials_url?: string | null;
  cover_image_url?: string | null;
  created_at: string;
  submitted: boolean;
  project_tracks?: {
    event_tracks?: {
      name?: string | null;
    } | null;
  }[];
  artifacts?: ExportArtifact[];
  submission_fields?: ExportField[];
  submission_values?: Record<string, SubmissionValue>;
};

const BUILT_IN_SUBMISSION_KEYS = new Set([
  "project_name",
  "project_description",
  "project_url",
  "video_url",
  "cover_image",
  "additional_materials",
]);

export function formatSubmissionValue(value: SubmissionValue | undefined): string {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(" | ");
  }

  return typeof value === "string" ? value : "";
}

function formatArtifactUrls(
  artifacts: ExportArtifact[] | undefined,
  kind: ExportArtifact["kind"]
): string {
  return (artifacts || [])
    .filter((artifact) => artifact.kind === kind && artifact.url)
    .map((artifact) => artifact.url)
    .join(" | ");
}

// MLH submission portal requirements list GitHub link as a required field
// distinct from the generic project / try-it-out URL. Detect it from the
// project_link artifacts by URL pattern so organizers don't need a dedicated
// custom field, while still surfacing it as its own column in the export.
// See: https://guide.mlh.io/general-information/judging-and-submissions/hackathon-submission-portal
function formatGithubUrls(artifacts: ExportArtifact[] | undefined): string {
  return (artifacts || [])
    .filter(
      (artifact) =>
        artifact.kind === "project_link" &&
        artifact.url &&
        /(^|\/\/|\.)github\.com\//i.test(artifact.url)
    )
    .map((artifact) => artifact.url)
    .join(" | ");
}

function formatAllArtifacts(artifacts: ExportArtifact[] | undefined): string {
  return (artifacts || [])
    .filter((artifact) => artifact.url)
    .map((artifact) =>
      artifact.label?.trim() ? `${artifact.label}: ${artifact.url}` : artifact.url
    )
    .join(" | ");
}

function splitDisplayName(displayName: string | null | undefined): {
  first: string;
  last: string;
} {
  const name = displayName?.trim() ?? "";
  const spaceIdx = name.indexOf(" ");
  if (spaceIdx === -1) return { first: name, last: "" };
  return {
    first: name.slice(0, spaceIdx).trim(),
    last: name.slice(spaceIdx + 1).trim(),
  };
}

function buildTeamMemberColumns(
  projects: SubmissionExportProject[]
): number {
  let max = 0;
  for (const project of projects) {
    const nonLeadTeammates = (project.teammates ?? []).filter(
      (e) => e !== project.lead_email
    );
    if (nonLeadTeammates.length > max) max = nonLeadTeammates.length;
  }
  return max;
}

export function buildCustomFieldColumns(projects: SubmissionExportProject[]) {
  const keyToLabel = new Map<string, string>();
  const labelCounts = new Map<string, number>();

  for (const project of projects) {
    for (const field of project.submission_fields || []) {
      if (!field?.key || BUILT_IN_SUBMISSION_KEYS.has(field.key)) {
        continue;
      }

      if (!keyToLabel.has(field.key)) {
        const label = field.label?.trim() || field.key;
        keyToLabel.set(field.key, label);
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
      }
    }
  }

  // Preserve first-seen insertion order (from the form schema) rather than
  // sorting alphabetically. MLH compliance exports require stable column order
  // across exports so downstream spreadsheets / import scripts don't break when
  // organizers add a new custom field.
  return Array.from(keyToLabel.entries()).map(([key, label]) => ({
    key,
    columnLabel: (labelCounts.get(label) || 0) > 1 ? `${label} (${key})` : label,
  }));
}

export function buildSubmissionExportRows(projects: SubmissionExportProject[]) {
  const customFieldColumns = buildCustomFieldColumns(projects);
  const maxNonLeadTeammates = buildTeamMemberColumns(projects);

  return projects.map((project) => {
    const leadName = splitDisplayName(project.lead_name);

    const row: Record<string, string | boolean> = {
      "Project Name": project.project_name || "",
      "Lead Name": project.lead_name || "",
      "Lead First Name": leadName.first,
      "Lead Last Name": leadName.last,
      "Lead Email": project.lead_email || "",
      "Lead School": project.lead_school || "",
      Description: project.project_description || "",
      "Primary Project URL": project.project_url || "",
      "GitHub URL": formatGithubUrls(project.artifacts),
      "All Project Links": formatArtifactUrls(project.artifacts, "project_link"),
      "Video Links": formatArtifactUrls(project.artifacts, "video_link"),
      "Additional Material Links": formatArtifactUrls(
        project.artifacts,
        "additional_material"
      ),
      "Cover Image URL": project.cover_image_url || "",
      "All Submission Artifacts": formatAllArtifacts(project.artifacts),
      "Team Members": (project.teammates || []).join(", "),
      Tracks:
        project.project_tracks
          ?.map((pt) => pt.event_tracks?.name)
          .filter(Boolean)
          .join(", ") || "No tracks",
      Submitted: project.submitted,
      "Created At": project.created_at,
    };

    // Per-member columns: filter lead from teammates to avoid duplication,
    // then emit Member N First Name / Last Name / Email / School for each slot
    // up to the max team size across all projects.
    const profileByEmail = new Map(
      (project.teammate_profiles ?? []).map((p) => [p.email, p])
    );
    const nonLeadTeammates = (project.teammates ?? []).filter(
      (e) => e !== project.lead_email
    );

    for (let i = 0; i < maxNonLeadTeammates; i++) {
      const memberNum = i + 1;
      const email = nonLeadTeammates[i] ?? "";
      const profile = email ? profileByEmail.get(email) : undefined;
      const memberName = splitDisplayName(profile?.display_name);

      row[`Member ${memberNum} First Name`] = memberName.first;
      row[`Member ${memberNum} Last Name`] = memberName.last;
      row[`Member ${memberNum} Email`] = email;
      row[`Member ${memberNum} School`] = profile?.affiliation ?? "";
    }

    for (const field of customFieldColumns) {
      row[field.columnLabel] = formatSubmissionValue(
        project.submission_values?.[field.key]
      );
    }

    return row;
  });
}
