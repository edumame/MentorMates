import type { Project } from '@/lib/types';
import { buildArtifactsUpdate } from '@/features/projects/client-actions/client-project-artifacts';
import { normalizeSubmissionValue } from '@/features/projects/utils/effectiveSubmission';

export function buildMaterialsUpdate(project: Project, url: string) {
  if (project.has_submission_field_config) {
    const field = project.submission_fields?.find((item) => item.key === 'additional_materials');
    if (!field) throw new Error('This event does not have an additional materials field. Edit its submission form instead.');
    const previous = project.submission_answers?.find((answer) => answer.event_submission_field_id === field.id)?.answer;
    const remaining = Array.isArray(previous) ? previous.slice(1) : [];
    const answer = normalizeSubmissionValue(field, url ? [url, ...remaining] : remaining);
    // Answers from another event's fields stay stored after a move, and the
    // server rejects any answer outside the current event's fields.
    const otherFieldIds = new Set(project.submission_fields?.map((item) => item.id).filter((id) => id !== field.id));
    return {
      submission_answers: [
        ...(project.submission_answers || [])
          .filter((item) => otherFieldIds.has(item.event_submission_field_id))
          .map((item) => ({ eventSubmissionFieldId: item.event_submission_field_id, answer: item.answer })),
        { eventSubmissionFieldId: field.id, answer },
      ],
    };
  }
  return { additional_materials_url: url, artifacts: buildArtifactsUpdate(project, 'additional_material', url) };
}

export async function patchProject(projectId: string, body: unknown, fallbackError: string): Promise<Project> {
  const response = await fetch(`/api/projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.project) throw new Error(result.error || fallbackError);
  return result.project;
}

export function saveProjectMaterials(project: Project, url: string): Promise<Project> {
  return patchProject(project.id, buildMaterialsUpdate(project, url.trim()), 'Failed to save slide deck');
}
