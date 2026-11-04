import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import type { Project } from '@/lib/types';
import { NewProjectSubmissionFormSinglePage } from './NewProjectSubmissionFormSinglePage';
import DraftProjectSubmissionFormSinglePage from './DraftProjectSubmissionFormSinglePage';

const mockUpload = jest.fn();

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
  useProjectSubmissionAutosave: () => ({ lastSaved: null, flushSave: jest.fn(), isSaving: false }),
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
