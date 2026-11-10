import { buildProjectFieldUpdate, saveProjectField } from './client-project-fields';
import type { Project } from '@/lib/types';

const field = (id: string, key: string, field_type = 'url') => ({ id, key, field_type, is_active: true });

const configured = {
  id: 'p1',
  has_submission_field_config: true,
  project_name: 'Old name',
  project_description: 'Old description',
  project_url: 'https://example.com/old',
  cover_image_url: 'https://example.com/cover.png',
  submission_fields: [
    field('name', 'project_name', 'short_text'),
    field('description', 'project_description', 'long_text'),
    field('url', 'project_url'),
    field('cover', 'cover_image', 'file'),
  ],
  submission_answers: [
    { event_submission_field_id: 'name', answer: 'Old name' },
    { event_submission_field_id: 'description', answer: 'Old description' },
    { event_submission_field_id: 'url', answer: 'https://example.com/old' },
    { event_submission_field_id: 'cover', answer: 'https://example.com/cover.png' },
  ],
} as unknown as Project;

const artifact = (kind: string, url: string, is_primary = true, sort_order = 0) => ({
  kind, label: 'Link', url, sort_order, is_primary, metadata: null,
});

const legacy = {
  id: 'p1',
  project_name: 'Old name',
  project_url: 'https://example.com/old',
  video_url: 'https://example.com/video',
  additional_materials_url: 'https://example.com/deck.pdf',
  has_submission_field_config: false,
  artifacts: [
    artifact('project_link', 'https://example.com/old'),
    artifact('project_link', 'https://example.com/extra', false, 1),
    artifact('video_link', 'https://example.com/video'),
    artifact('additional_material', 'https://example.com/deck.pdf'),
  ],
} as unknown as Project;

const answersOf = (update: ReturnType<typeof buildProjectFieldUpdate>) =>
  (update as { submission_answers: Array<{ eventSubmissionFieldId: string; answer: unknown }> }).submission_answers;

const urlsOf = (update: ReturnType<typeof buildProjectFieldUpdate>, kind: string) =>
  ((update as { artifacts: Array<{ kind: string; url: string }> }).artifacts)
    .filter((item) => item.kind === kind)
    .map((item) => item.url);

describe('buildProjectFieldUpdate on configured events', () => {
  it('sends the full answer set with only the title changed', () => {
    expect(buildProjectFieldUpdate(configured, 'project_name', 'New name')).toEqual({
      project_name: 'New name',
      submission_answers: [
        { eventSubmissionFieldId: 'name', answer: 'New name' },
        { eventSubmissionFieldId: 'description', answer: 'Old description' },
        { eventSubmissionFieldId: 'url', answer: 'https://example.com/old' },
        { eventSubmissionFieldId: 'cover', answer: 'https://example.com/cover.png' },
      ],
    });
  });

  it('replaces the project URL answer without writing artifacts', () => {
    const update = buildProjectFieldUpdate(configured, 'project_url', 'https://example.com/new');
    expect(update).not.toHaveProperty('artifacts');
    expect(answersOf(update)).toContainEqual({
      eventSubmissionFieldId: 'url', answer: 'https://example.com/new',
    });
  });

  it('drops the answer when a URL or cover is cleared', () => {
    for (const [key, id] of [['project_url', 'url'], ['cover_image', 'cover']] as const) {
      const answers = answersOf(buildProjectFieldUpdate(configured, key, ''));
      expect(answers.map((item) => item.eventSubmissionFieldId)).not.toContain(id);
      expect(answers).toHaveLength(3);
    }
  });

  it('keeps a value that only exists in the column, because PATCH nulls those columns', () => {
    const project = {
      ...configured,
      submission_answers: configured.submission_answers?.filter(
        (item) => item.event_submission_field_id !== 'cover',
      ),
    } as Project;
    expect(answersOf(buildProjectFieldUpdate(project, 'project_name', 'New name'))).toContainEqual({
      eventSubmissionFieldId: 'cover', answer: 'https://example.com/cover.png',
    });
  });

  it('keeps secondary links on a multi-value field', () => {
    const project = {
      ...configured,
      submission_fields: [field('url', 'project_url', 'multi_url')],
      submission_answers: [{ event_submission_field_id: 'url', answer: ['old', 'second'] }],
    } as unknown as Project;
    expect(answersOf(buildProjectFieldUpdate(project, 'project_url', 'new'))).toEqual([
      { eventSubmissionFieldId: 'url', answer: ['new', 'second'] },
    ]);
    expect(answersOf(buildProjectFieldUpdate(project, 'project_url', ''))).toEqual([
      { eventSubmissionFieldId: 'url', answer: ['second'] },
    ]);
  });

  it('refuses a field the event does not collect', () => {
    expect(() => buildProjectFieldUpdate(configured, 'video_url', 'https://example.com/v')).toThrow(
      'does not have a video URL field',
    );
  });

  it('still saves the title when the event has no project_name field', () => {
    const project = {
      ...configured,
      submission_fields: [field('url', 'project_url')],
      submission_answers: [{ event_submission_field_id: 'url', answer: 'https://example.com/old' }],
    } as unknown as Project;
    expect(buildProjectFieldUpdate(project, 'project_name', 'New name')).toEqual({
      project_name: 'New name',
      submission_answers: [{ eventSubmissionFieldId: 'url', answer: 'https://example.com/old' }],
    });
  });

  it('refuses to drop answers to retired fields', () => {
    const project = {
      ...configured,
      submission_answers: [
        ...(configured.submission_answers || []),
        { event_submission_field_id: 'retired', answer: 'keep me' },
      ],
    } as Project;
    expect(() => buildProjectFieldUpdate(project, 'project_name', 'New name')).toThrow(
      'older submission form',
    );
  });
});

describe('buildProjectFieldUpdate on non-configured events', () => {
  it('writes only the column for the title and description', () => {
    expect(buildProjectFieldUpdate(legacy, 'project_name', 'New name')).toEqual({ project_name: 'New name' });
    expect(buildProjectFieldUpdate(legacy, 'project_description', 'New')).toEqual({ project_description: 'New' });
  });

  it('replaces the primary link and keeps every other artifact', () => {
    const update = buildProjectFieldUpdate(legacy, 'project_url', 'https://example.com/new');
    expect(update).toHaveProperty('project_url', 'https://example.com/new');
    expect(urlsOf(update, 'project_link').sort()).toEqual(['https://example.com/extra', 'https://example.com/new']);
    expect(urlsOf(update, 'video_link')).toEqual(['https://example.com/video']);
    expect(urlsOf(update, 'additional_material')).toEqual(['https://example.com/deck.pdf']);
  });

  it('removes the primary artifact on clear and sends a defined value', () => {
    const update = buildProjectFieldUpdate(legacy, 'video_url', '');
    expect(update).toHaveProperty('video_url', '');
    expect(urlsOf(update, 'video_link')).toEqual([]);
    expect(urlsOf(update, 'project_link')).toHaveLength(2);
  });

  it('does not duplicate a link that is promoted from an extra', () => {
    const update = buildProjectFieldUpdate(legacy, 'project_url', 'https://example.com/extra');
    expect(urlsOf(update, 'project_link')).toEqual(['https://example.com/extra']);
  });

  it('creates a primary artifact when the kind has none', () => {
    const project = { ...legacy, video_url: null, artifacts: [] } as unknown as Project;
    expect(buildProjectFieldUpdate(project, 'video_url', 'https://example.com/v')).toMatchObject({
      artifacts: expect.arrayContaining([
        expect.objectContaining({ kind: 'video_link', url: 'https://example.com/v', is_primary: true }),
      ]),
    });
  });

  it('keeps column URLs that have no or stale artifact rows', () => {
    const project = {
      ...legacy,
      project_url: 'https://example.com/edited-inline',
      artifacts: [artifact('project_link', 'https://example.com/stale')],
    } as unknown as Project;
    const update = buildProjectFieldUpdate(project, 'video_url', 'https://example.com/new-video');
    expect(urlsOf(update, 'project_link')).toEqual(['https://example.com/edited-inline']);
    expect(urlsOf(update, 'additional_material')).toEqual(['https://example.com/deck.pdf']);
  });

  it('clears the cover with an empty string, which the write schema keeps', () => {
    expect(buildProjectFieldUpdate(legacy, 'cover_image', '')).toEqual({ cover_image_url: '' });
  });
});

describe('saveProjectField', () => {
  it('PATCHes the trimmed value and returns the hydrated project', async () => {
    const saved = { id: 'p1', project_name: 'New name' };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ project: saved }) });
    await expect(saveProjectField(legacy, 'project_name', '  New name ')).resolves.toBe(saved);
    expect(global.fetch).toHaveBeenCalledWith('/api/projects/p1', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ project_name: 'New name' }),
    }));
  });

  it('surfaces the server reason, such as a passed deadline', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, json: async () => ({ error: 'Project submission deadline has passed' }),
    });
    await expect(saveProjectField(legacy, 'project_name', 'New name')).rejects.toThrow(
      'Project submission deadline has passed',
    );
  });

  it('falls back to a readable error when the response is not JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, json: async () => { throw new SyntaxError('Unexpected token <'); },
    });
    await expect(saveProjectField(legacy, 'cover_image', '')).rejects.toThrow('Failed to update cover image');
  });
});
