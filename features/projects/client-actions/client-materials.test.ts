import { buildMaterialsUpdate, saveProjectMaterials } from './client-materials';
import type { Project } from '@/lib/types';
import { deriveLegacySubmissionFieldsFromArtifacts, type ProjectArtifactRecord } from '@/features/projects/utils/submission';

const row = (kind: string, url: string, is_primary = true, sort_order = 0) => ({
  kind, label: 'Link', url, sort_order, is_primary, metadata: null,
});
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

describe('materials save on a project with stale artifact rows', () => {
  // The state older column-only inline edits left behind.
  const stale = {
    id: 'p1',
    has_submission_field_config: false,
    project_url: 'https://new.example',
    video_url: 'https://new.example/video',
    additional_materials_url: 'https://example.com/old.pdf',
    artifacts: [
      row('project_link', 'https://old.example'),
      row('project_link', 'https://extra.example', false, 1),
      row('video_link', 'https://old.example/video'),
      row('additional_material', 'https://example.com/old.pdf'),
      row('additional_material', 'https://example.com/appendix.pdf', false, 1),
    ],
  } as unknown as Project;

  // A PATCH with artifacts rederives every URL column from them on the server.
  const derive = (update: ReturnType<typeof buildMaterialsUpdate>) =>
    deriveLegacySubmissionFieldsFromArtifacts(update.artifacts as ProjectArtifactRecord[]);
  const urls = (update: ReturnType<typeof buildMaterialsUpdate>) => update.artifacts?.map((item) => item.url);

  it('derives the current project and video columns, not the stale rows', () => {
    const update = buildMaterialsUpdate(stale, 'https://deck.example');
    expect(update.additional_materials_url).toBe('https://deck.example');
    expect(derive(update)).toEqual({
      project_url: 'https://new.example',
      video_url: 'https://new.example/video',
      additional_materials_url: 'https://deck.example',
    });
    expect(urls(update)).not.toEqual(expect.arrayContaining(['https://old.example']));
    expect(urls(update)).not.toEqual(expect.arrayContaining(['https://old.example/video']));
  });

  it('keeps the current columns when the materials are cleared', () => {
    const update = buildMaterialsUpdate(stale, '');
    expect(update.additional_materials_url).toBe('');
    expect(derive(update)).toMatchObject({
      project_url: 'https://new.example',
      video_url: 'https://new.example/video',
    });
    expect(urls(update)).not.toContain('https://example.com/old.pdf');
  });

  it('keeps extra links and extra materials', () => {
    const update = buildMaterialsUpdate(stale, 'https://deck.example');
    expect(urls(update)).toEqual(expect.arrayContaining(['https://extra.example', 'https://example.com/appendix.pdf']));
    expect(urls(update)).not.toContain('https://example.com/old.pdf');
  });

  it('sends the reconciled artifacts through the PATCH', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ project: stale }) });
    global.fetch = fetchMock;
    await saveProjectMaterials(stale, ' https://deck.example ');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(deriveLegacySubmissionFieldsFromArtifacts(body.artifacts)).toMatchObject({
      project_url: 'https://new.example',
      video_url: 'https://new.example/video',
      additional_materials_url: 'https://deck.example',
    });
  });
});
