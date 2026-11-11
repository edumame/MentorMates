import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import type { EventSubmissionField, Project } from '@/lib/types';
import { NewProjectSubmissionFormSinglePage } from './NewProjectSubmissionFormSinglePage';
import DraftProjectSubmissionFormSinglePage from './DraftProjectSubmissionFormSinglePage';
import { buildSubmissionAnswersPayload, type SubmissionValue } from '@/features/projects/utils/effectiveSubmission';

const mockUpload = jest.fn();
const mockAutosave = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('@/lib/supabase', () => {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'insert', 'update']) {
    query[method] = () => query;
  }
  query.maybeSingle = async () => ({ data: null, error: null });
  query.single = async () => ({ data: null, error: null });
  query.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null });
  return {
    supabase: {
      from: () => query,
      auth: { getSession: async () => ({ data: { session: null } }) },
      storage: {
        from: () => ({
          upload: (...args: unknown[]) => mockUpload(...args),
          getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.example/uploaded.pdf' } }),
        }),
      },
    },
  };
});
jest.mock('@/lib/hooks/use-admin', () => ({ useAdmin: () => false }));
jest.mock('@/components/ui/toaster', () => ({ Toaster: () => null }));
jest.mock('@/components/utils/UserSearchWithInvite', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/events/event-card', () => ({ EventCard: () => null }));
jest.mock('@/components/projects/ProjectDescription', () => ({ ProjectDescription: () => null }));
jest.mock('@mui/icons-material', () => ({ TextFields: () => null }));
jest.mock('@/features/intake-forms/components/ParticipantIntakeDialog', () => ({ ParticipantIntakeDialog: () => null }));
jest.mock('@/features/projects/components/displays/cover-image-with-fallback', () => ({ CoverImageWithFallback: () => null }));
jest.mock('@/features/projects/components/displays/ProjectFieldEntriesSection', () => ({ ProjectFieldEntriesSection: () => null }));
jest.mock('@/features/projects/components/forms/hooks/useProjectSubmissionAutosave', () => ({
  useProjectSubmissionAutosave: (options: unknown) => {
    mockAutosave(options);
    return { lastSaved: null, flushSave: jest.fn(), isSaving: false };
  },
}));

const forms = [
  ['New', () => <NewProjectSubmissionFormSinglePage userEmail="lead@example.com" leadName="Lead" />],
  ['Draft', () => (
    <DraftProjectSubmissionFormSinglePage
      projectId="project-1"
      session={null as Session | null}
      canEdit
      project={{ id: 'project-1', event_id: '', teammates: [] } as unknown as Project}
    />
  )],
] as const;

const materialRows = () =>
  screen.getAllByPlaceholderText(/https:\/\//).filter((input) =>
    input.closest('div')?.textContent?.includes('Remove'));

beforeEach(() => {
  mockAutosave.mockClear();
  mockUpload.mockResolvedValue({ error: null });
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ fields: [], users: [] }) })) as unknown as typeof fetch;
});

describe.each(forms)('%s form additional materials', (_name, renderForm) => {
  it('adds a second link row that can be typed into', async () => {
    render(renderForm());
    const addLink = await screen.findByText('Add another link');
    fireEvent.change(materialRows()[0], { target: { value: 'https://one.example' } });
    fireEvent.click(addLink);
    expect(materialRows()).toHaveLength(2);
    fireEvent.change(materialRows()[1], { target: { value: 'https://two.example' } });
    expect(materialRows().map((input) => (input as HTMLInputElement).value)).toEqual([
      'https://one.example',
      'https://two.example',
    ]);
  });

  it('keeps the second link in its row when the first is cleared', async () => {
    render(renderForm());
    const addLink = await screen.findByText('Add another link');
    fireEvent.change(materialRows()[0], { target: { value: 'https://one.example' } });
    fireEvent.click(addLink);
    fireEvent.change(materialRows()[1], { target: { value: 'https://two.example' } });
    fireEvent.change(materialRows()[0], { target: { value: '' } });
    expect(materialRows().map((input) => (input as HTMLInputElement).value)).toEqual([
      '',
      'https://two.example',
    ]);
  });

  it('puts an upload in the empty first row instead of after it', async () => {
    render(renderForm());
    await screen.findByText('Add another link');
    const fileInput = materialRows()[0].parentElement!.querySelector('input[type="file"]')!;
    fireEvent.change(fileInput, { target: { files: [new File(['notes'], 'notes.pdf')] } });
    await waitFor(() =>
      expect(materialRows().map((input) => (input as HTMLInputElement).value)).toEqual([
        'https://cdn.example/uploaded.pdf',
      ])
    );
  });
});

describe('configured link fields', () => {
  const field = (id: string, key: string, label: string, sort_order: number, field_type = 'multi_url') => ({
    id, key, label, sort_order, field_type, event_id: 'event-1', required: false, is_active: true,
    placeholder: `${key} row`,
  }) as EventSubmissionField;
  const linkFields = [
    field('f-project', 'project_url', 'Project URL', 0),
    field('f-video', 'video_url', 'Demo Video', 1),
    field('f-materials', 'additional_materials', 'Additional Materials', 2),
  ];

  const renderNew = (fields: EventSubmissionField[]) => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ fields, users: [] }) })) as unknown as typeof fetch;
    render(<NewProjectSubmissionFormSinglePage userEmail="lead@example.com" leadName="Lead" eventId="event-1" />);
  };
  const renderDraft = (
    fields: EventSubmissionField[],
    answers: Record<string, SubmissionValue> = {},
    legacy: Partial<Project> = {},
  ) => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ fields, users: [] }) })) as unknown as typeof fetch;
    const project = {
      id: 'project-1', event_id: 'event-1', teammates: [], has_submission_field_config: true,
      submission_fields: fields,
      submission_answers: Object.entries(answers).map(([event_submission_field_id, answer]) => ({ event_submission_field_id, answer })),
      ...legacy,
    } as unknown as Project;
    render(<DraftProjectSubmissionFormSinglePage projectId="project-1" session={null as Session | null} canEdit project={project} />);
  };

  const rows = (key: string) => screen.queryAllByPlaceholderText(`${key} row`) as HTMLInputElement[];
  const rowValues = (key: string) => rows(key).map((input) => input.value);
  const addLink = (key: string) =>
    fireEvent.click(within(rows(key)[0].closest('.space-y-2') as HTMLElement).getByText('Add another link'));
  const autosaved = () => {
    const { fields, values } = mockAutosave.mock.lastCall![0] as {
      fields: EventSubmissionField[];
      values: Record<string, SubmissionValue>;
    };
    return buildSubmissionAnswersPayload(fields, values);
  };

  describe.each([
    ['New', (fields: EventSubmissionField[]) => renderNew(fields)],
    ['Draft', (fields: EventSubmissionField[]) => renderDraft(fields)],
  ] as const)('%s form', (_name, renderForm) => {
    it.each([
      ['project_url', 'f-project'],
      ['video_url', 'f-video'],
    ])('adds and saves a second %s link', async (key, fieldId) => {
      renderForm(linkFields);
      await waitFor(() => expect(rows(key)).toHaveLength(1));
      fireEvent.change(rows(key)[0], { target: { value: 'https://a.example' } });
      addLink(key);
      expect(rowValues(key)).toEqual(['https://a.example', '']);
      expect(autosaved()).toContainEqual({ eventSubmissionFieldId: fieldId, answer: ['https://a.example'] });
      fireEvent.change(rows(key)[1], { target: { value: 'https://b.example' } });
      expect(rowValues(key)).toEqual(['https://a.example', 'https://b.example']);
      expect(autosaved()).toContainEqual({
        eventSubmissionFieldId: fieldId,
        answer: ['https://a.example', 'https://b.example'],
      });
    });

    it('removes one row of a built-in multi_url field', async () => {
      renderForm(linkFields);
      await waitFor(() => expect(rows('project_url')).toHaveLength(1));
      fireEvent.change(rows('project_url')[0], { target: { value: 'https://a.example' } });
      addLink('project_url');
      fireEvent.change(rows('project_url')[1], { target: { value: 'https://b.example' } });
      fireEvent.click(within(rows('project_url')[0].parentElement as HTMLElement).getByText('Remove'));
      expect(rowValues('project_url')).toEqual(['https://b.example']);
    });

    it('keeps a plain url field as a single string answer', async () => {
      renderForm([field('f-project', 'project_url', 'Project URL', 0, 'url')]);
      await waitFor(() => expect(rows('project_url')).toHaveLength(1));
      fireEvent.change(rows('project_url')[0], { target: { value: 'https://a.example' } });
      expect(rowValues('project_url')).toEqual(['https://a.example']);
      expect(autosaved()).toContainEqual({ eventSubmissionFieldId: 'f-project', answer: 'https://a.example' });
      expect(screen.queryByText('Add another link')).not.toBeInTheDocument();
    });
  });

  describe('Draft hydration', () => {
    const answers = {
      'f-project': ['https://p1.example', 'https://p2.example'],
      'f-video': ['https://v1.example', 'https://v2.example'],
      'f-materials': ['https://m1.example', 'https://m2.example'],
    };
    const savedAnswers = Object.entries(answers).map(([eventSubmissionFieldId, answer]) => ({ eventSubmissionFieldId, answer }));

    it('loads every saved link into its own row and keeps them in the saved values', async () => {
      // Matches applyEffectiveSubmissionToProject: only the first material reaches the legacy column.
      renderDraft(linkFields, answers, { additional_materials_url: 'https://m1.example' });
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());
      expect(rowValues('project_url')).toEqual(answers['f-project']);
      expect(rowValues('video_url')).toEqual(answers['f-video']);
      expect(rowValues('additional_materials')).toEqual(answers['f-materials']);
      expect(autosaved()).toEqual(savedAnswers);
    });

    it('keeps saved links when an unrelated row is edited', async () => {
      renderDraft(linkFields, answers, { additional_materials_url: 'https://m1.example' });
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());
      fireEvent.change(rows('project_url')[1], { target: { value: 'https://p3.example' } });
      expect(autosaved()).toEqual([
        { eventSubmissionFieldId: 'f-project', answer: ['https://p1.example', 'https://p3.example'] },
        ...savedAnswers.slice(1),
      ]);
    });

    it('keeps every saved file of a multi_file materials field', async () => {
      const files = ['https://cdn.example/a.pdf', 'https://cdn.example/b.pdf'];
      renderDraft(
        [field('f-materials', 'additional_materials', 'Additional Materials', 0, 'multi_file')],
        { 'f-materials': files },
        { additional_materials_url: files[0] },
      );
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());
      expect(autosaved()).toEqual([{ eventSubmissionFieldId: 'f-materials', answer: files }]);
    });

    it('falls back to the legacy column when a configured field has no saved answer', async () => {
      renderDraft(linkFields, {}, { project_url: 'https://legacy.example' });
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());
      expect(rowValues('project_url')).toEqual(['https://legacy.example']);
      expect(rowValues('video_url')).toEqual(['']);
    });
  });
});
