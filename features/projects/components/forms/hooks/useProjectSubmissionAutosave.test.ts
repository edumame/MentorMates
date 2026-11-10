import { act, renderHook } from '@testing-library/react';
import { useProjectSubmissionAutosave } from './useProjectSubmissionAutosave';
import { toast } from '@/lib/hooks/use-toast';
jest.mock('@/lib/hooks/use-toast', () => ({ toast: jest.fn() }));

const response = () => ({ ok: true, json: async () => ({ project: { id: 'p1' } }) });
const options = {
  enabled: true, projectId: 'p1', fields: [], hasConfiguredSubmissionFields: false,
  values: { additional_materials: ['https://example.com/deck.pdf'] },
};

describe('attachment autosave and explicit saves', () => {
  beforeEach(() => { jest.useFakeTimers(); global.fetch = jest.fn().mockResolvedValue(response()); });
  afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); });

  it('flushes a deck before the autosave delay and does not save it twice', async () => {
    const { result } = renderHook(() => useProjectSubmissionAutosave(options));
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => { expect(await result.current.flushSave()).toBe(true); });
    expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).additional_materials_url).toBe(options.values.additional_materials[0]);
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('waits for an old request before saving the newest deck', async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    (fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook(({ values }) => useProjectSubmissionAutosave({ ...options, values }), { initialProps: { values: options.values } });
    await act(async () => { jest.advanceTimersByTime(2000); });
    rerender({ values: { additional_materials: ['https://example.com/replacement.pdf'] } });
    await act(async () => {
      const flushed = result.current.flushSave();
      expect(fetch).toHaveBeenCalledTimes(1);
      finish(response());
      expect(await flushed).toBe(true);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse((fetch as jest.Mock).mock.calls[1][1].body).additional_materials_url).toContain('replacement.pdf');
  });

  it.each(['network', 'server'])('reports %s failure and allows an explicit retry', async (failure) => {
    if (failure === 'network') (fetch as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    else (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Save failed' }) });
    const { result } = renderHook(() => useProjectSubmissionAutosave(options));
    await act(async () => { expect(await result.current.flushSave()).toBe(false); });
    expect(result.current.lastSaved).toBeNull();
    expect(result.current.saveError).toBeTruthy();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Draft not saved' }));
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => { expect(await result.current.flushSave()).toBe(true); });
    expect(result.current.lastSaved).not.toBeNull();
  });
  it('surfaces initial creation failure, stops automatic retries while typing, and saves the latest values on explicit retry', async () => {
    const ensureProjectId = jest.fn().mockRejectedValueOnce(new Error('Draft service unavailable')).mockResolvedValue('p1');
    const { result, rerender } = renderHook(({ name }) => useProjectSubmissionAutosave({
      ...options, projectId: null, ensureProjectId, values: { project_name: name },
    }), { initialProps: { name: 'First draft' } });
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(result.current.saveError).toBe('Draft service unavailable');
    expect(result.current.lastSaved).toBeNull();
    expect(result.current.hasUnsavedChanges).toBe(true);
    rerender({ name: 'Latest draft' });
    await act(async () => { jest.advanceTimersByTime(10000); });
    expect(ensureProjectId).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => { expect(await result.current.flushSave()).toBe(true); });
    expect(ensureProjectId).toHaveBeenCalledTimes(2);
    expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).project_name).toBe('Latest draft');
    expect(result.current.saveError).toBeNull();
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('clears a failed-save block when retrying values already saved, then autosaves future edits', async () => {
    const { result, rerender } = renderHook(({ name }) => useProjectSubmissionAutosave({ ...options, values: { project_name: name } }), { initialProps: { name: 'A' } });
    await act(async () => { await result.current.flushSave(); });
    rerender({ name: 'B' });
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    await act(async () => { await result.current.flushSave(); });
    expect(result.current.saveError).toBe('Offline');
    rerender({ name: 'A' });
    await act(async () => { expect(await result.current.flushSave()).toBe(true); });
    expect(result.current.saveError).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
    rerender({ name: 'C' });
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(JSON.parse((fetch as jest.Mock).mock.calls[2][1].body).project_name).toBe('C');
  });

  it('shares a pending failure between rapid retries without issuing another request', async () => {
    let finish!: (value: object) => void;
    (fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useProjectSubmissionAutosave(options));
    await act(async () => {
      const first = result.current.flushSave();
      const second = result.current.flushSave();
      finish({ ok: false, status: 503, json: async () => ({ error: 'Offline' }) });
      expect(await first).toBe(false);
      expect(await second).toBe(false);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.saveError).toBe('Offline');
  });

});
