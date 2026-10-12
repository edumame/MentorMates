import type { Project } from '@/lib/types';
import { normalizeSubmissionValue } from '@/features/projects/utils/effectiveSubmission';
import { buildArtifactsFromLegacy } from '@/features/projects/utils/submission';

export function buildMaterialsUpdate(project: Project, url: string) {
  if (project.has_submission_field_config) {
    const field = project.submission_fields?.find((item) => item.key === 'additional_materials');
    if (!field) throw new Error('This event does not have an additional materials field. Edit its submission form instead.');
    const previous = project.submission_answers?.find((answer) => answer.event_submission_field_id === field.id)?.answer;
    const remaining = Array.isArray(previous) ? previous.slice(1) : [];
    const answer = normalizeSubmissionValue(field, url ? [url, ...remaining] : remaining);
    return {
      submission_answers: [
        ...(project.submission_answers || [])
          .filter((item) => item.event_submission_field_id !== field.id)
          .map((item) => ({ eventSubmissionFieldId: item.event_submission_field_id, answer: item.answer })),
        { eventSubmissionFieldId: field.id, answer },
      ],
    };
  }
  const artifacts = project.artifacts || buildArtifactsFromLegacy(project);
  const remaining = artifacts.filter((item) => item.kind !== 'additional_material' || item.url !== project.additional_materials_url);
  return {
    additional_materials_url: url,
    artifacts: [
      ...remaining,
      ...(url ? [{ kind: 'additional_material', label: 'Additional Material', url, sort_order: 0, is_primary: true }] : []),
    ],
  };
}

export async function saveProjectMaterials(project: Project, url: string): Promise<Project> {
  const response = await fetch(`/api/projects/${project.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildMaterialsUpdate(project, url.trim())),
  });
  const result = await response.json();
  if (!response.ok || !result.project) throw new Error(result.error || 'Failed to save slide deck');
  return result.project;
}
