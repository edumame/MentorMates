import type { Project, ProjectArtifact } from '@/lib/types';
import { buildArtifactsFromLegacy, type ProjectArtifactKind } from '@/features/projects/utils/submission';

function withPrimaryUrl(artifacts: ProjectArtifact[], kind: ProjectArtifactKind, url: string): ProjectArtifact[] {
  const sameKind = artifacts.filter((item) => item.kind === kind);
  const primary = sameKind.find((item) => item.is_primary) ?? sameKind[0];
  const others = artifacts.filter((item) => item !== primary && (item.kind !== kind || item.url !== url));
  if (!url) return others;
  const [legacy] = buildArtifactsFromLegacy({
    project_url: kind === 'project_link' ? url : null,
    video_url: kind === 'video_link' ? url : null,
    additional_materials_url: kind === 'additional_material' ? url : null,
  });
  return [...others, primary ? { ...primary, url, is_primary: true } : legacy];
}

// A PATCH with artifacts replaces every row and rederives all URL columns from
// them, so rows left stale by older column-only writes must follow the columns.
export function buildArtifactsUpdate(project: Project, kind: ProjectArtifactKind, url: string) {
  const columns: Array<[ProjectArtifactKind, string | null | undefined]> = [
    ['project_link', project.project_url],
    ['video_link', project.video_url],
    ['additional_material', project.additional_materials_url],
  ];
  const artifacts = columns.reduce(
    (current, [columnKind, columnUrl]) =>
      columnKind !== kind && columnUrl ? withPrimaryUrl(current, columnKind, columnUrl) : current,
    project.artifacts || [],
  );
  return withPrimaryUrl(artifacts, kind, url);
}
