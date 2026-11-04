import type { Project } from '@/lib/types';
import { patchProject } from '@/features/projects/client-actions/client-materials';
import { buildArtifactsUpdate } from '@/features/projects/client-actions/client-project-artifacts';
import {
  buildSubmissionAnswersPayload,
  buildSubmissionValuesFromProject,
  hasSubmissionFieldMismatch,
} from '@/features/projects/utils/effectiveSubmission';

export type InlineProjectField = 'project_name' | 'project_description' | 'project_url' | 'video_url' | 'cover_image';

const FIELD_LABELS: Record<InlineProjectField, string> = {
  project_name: 'project title',
  project_description: 'project description',
  project_url: 'project URL',
  video_url: 'video URL',
  cover_image: 'cover image',
};

function buildConfiguredUpdate(project: Project, key: InlineProjectField, value: string) {
  const fields = project.submission_fields || [];
  const field = fields.find((item) => item.key === key);
  const isLockedField = key === 'project_name' || key === 'project_description';
  if (!field && !isLockedField) {
    throw new Error(`This event does not have a ${FIELD_LABELS[key]} field. Edit its submission form instead.`);
  }
  // PATCH replaces the whole answer set, so answers to retired fields would be lost.
  if (hasSubmissionFieldMismatch(project.submission_answers, fields)) {
    throw new Error('This project has answers from an older submission form. Review them on the Edit page instead.');
  }
  const values = buildSubmissionValuesFromProject(project, fields);
  const previous = values[key];
  if (field) {
    values[key] = Array.isArray(previous) ? [value, ...previous.slice(1)] : value;
  }
  return {
    ...(isLockedField ? { [key]: value } : {}),
    submission_answers: buildSubmissionAnswersPayload(fields, values),
  };
}

export function buildProjectFieldUpdate(project: Project, key: InlineProjectField, value: string) {
  if (project.has_submission_field_config) return buildConfiguredUpdate(project, key, value);
  switch (key) {
    case 'project_url':
      return { project_url: value, artifacts: buildArtifactsUpdate(project, 'project_link', value) };
    case 'video_url':
      return { video_url: value, artifacts: buildArtifactsUpdate(project, 'video_link', value) };
    case 'cover_image':
      // The write schema drops null, so an empty string is what clears this column.
      return { cover_image_url: value };
    default:
      return { [key]: value };
  }
}

export function saveProjectField(project: Project, key: InlineProjectField, value: string): Promise<Project> {
  return patchProject(
    project.id,
    buildProjectFieldUpdate(project, key, value.trim()),
    `Failed to update ${FIELD_LABELS[key]}`,
  );
}
