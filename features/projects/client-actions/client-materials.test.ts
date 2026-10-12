import { buildMaterialsUpdate, saveProjectMaterials } from './client-materials';
import type { Project } from '@/lib/types';
const project = {
  id: 'p1', has_submission_field_config: true,
  submission_fields: [{ id: 'deck', key: 'additional_materials', field_type: 'file' }],
  submission_answers: [
    { event_submission_field_id: 'name', answer: 'My project' },
    { event_submission_field_id: 'deck', answer: 'https://example.com/old.pdf' },
  ],
} as Project;

describe('deck replacement persistence', () => {
  it('updates the configured answer and preserves other answers', () => {
    expect(buildMaterialsUpdate(project, 'https://example.com/new.pdf')).toEqual({ submission_answers: [
      { eventSubmissionFieldId: 'name', answer: 'My project' },
      { eventSubmissionFieldId: 'deck', answer: 'https://example.com/new.pdf' },
    ] });
  });
  it('preserves secondary files when replacing a multi-file primary', () => {
    const multi = { ...project, submission_fields: [{ ...project.submission_fields![0], field_type: 'multi_file' as const }],
      submission_answers: [{ event_submission_field_id: 'deck', answer: ['old', 'appendix'] }] } as Project;
    expect(buildMaterialsUpdate(multi, 'new').submission_answers).toEqual([{ eventSubmissionFieldId: 'deck', answer: ['new', 'appendix'] }]);
  });
  it('keeps legacy project links and replaces the old material artifact', () => {
    const legacy = { id: 'p1', project_url: 'https://example.com', additional_materials_url: 'https://example.com/old.pdf' } as Project;
    const update = buildMaterialsUpdate(legacy, 'https://example.com/new.pdf');
    expect(update.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'project_link', url: 'https://example.com' }),
      expect.objectContaining({ kind: 'additional_material', url: 'https://example.com/new.pdf' }),
    ]));
    expect(update.artifacts?.some(item => item.url.endsWith('old.pdf'))).toBe(false);
  });
  it('does not report success when persistence fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Permission denied' }) });
    await expect(saveProjectMaterials(project, 'new')).rejects.toThrow('Permission denied');
  });
});
