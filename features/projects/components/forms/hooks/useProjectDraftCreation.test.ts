import { act, renderHook } from '@testing-library/react';
import { useProjectDraftCreation } from './useProjectDraftCreation';
import { useProjectSubmissionAutosave } from './useProjectSubmissionAutosave';
import { toast } from '@/lib/hooks/use-toast';

jest.mock('@/lib/hooks/use-toast', () => ({ toast: jest.fn() }));
const response = (body: object, ok = true) => ({ ok, json: async () => body });
const options = { leadName: 'Tester', leadEmail: 'test@example.com', contextus: false };

function useDraft() {
  const draft = useProjectDraftCreation(options);
  const save = useProjectSubmissionAutosave({
    ...draft, enabled: true, fields: [], hasConfiguredSubmissionFields: false,
    values: { project_name: 'testing', project_description: 'testing' },
  });
  return { ...draft, ...save };
}

describe('new project draft saving', () => {
  beforeEach(() => { global.fetch = jest.fn(); jest.clearAllMocks(); });

  it('waits for background creation and saves to the created ID without a duplicate POST', async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    (fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValueOnce(response({ project: { id: 'p1' } }));
    const { result } = renderHook(useDraft);
    await act(async () => {
      const creating = result.current.ensureProjectId();
      const saving = result.current.flushSave();
      expect(fetch).toHaveBeenCalledTimes(1);
      finish(response({ id: 'p1' }));
      expect(await saving).toBe(true);
      expect(await creating).toBe('p1');
      // The ID must be available even before React commits the state update.
      expect(await result.current.ensureProjectId()).toBe('p1');
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith('/api/projects/p1', expect.objectContaining({ method: 'PATCH' }));
    expect(JSON.parse((fetch as jest.Mock).mock.calls[1][1].body)).toEqual(expect.objectContaining({
      project_name: 'testing', project_description: 'testing',
    }));
    expect(toast).not.toHaveBeenCalled();
  });

  it('creates a draft on explicit save even if background creation never started', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(response({ id: 'p1' }))
      .mockResolvedValueOnce(response({ project: { id: 'p1' } }));
    const { result } = renderHook(useDraft);
    await act(async () => { expect(await result.current.flushSave()).toBe(true); });
    expect(result.current.projectId).toBe('p1');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each(['server', 'network', 'missing ID'])('reports %s creation failures and retries on save', async (failure) => {
    const mockFetch = fetch as jest.Mock;
    if (failure === 'network') mockFetch.mockRejectedValueOnce(new Error('Offline'));
    else mockFetch.mockResolvedValueOnce(failure === 'server'
      ? response({ error: 'Database unavailable' }, false) : response({}));
    const { result } = renderHook(useDraft);
    await act(async () => { expect(await result.current.flushSave()).toBe(false); });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Draft not saved' }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.projectId).toBeNull();
    mockFetch.mockResolvedValueOnce(response({ id: 'p1' }))
      .mockResolvedValueOnce(response({ project: { id: 'p1' } }));
    await act(async () => { expect(await result.current.flushSave()).toBe(true); });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
