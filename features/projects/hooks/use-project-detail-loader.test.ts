import { act, renderHook, waitFor } from '@testing-library/react';
import { useProjectDetailLoader } from './use-project-detail-loader';
const response = (id: string) => ({ ok: true, status: 200, json: async () => ({ project: { id } }) });
const originalFetch = global.fetch;
beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { global.fetch = originalFetch; });
test('transport failure ends loading and retry restores project', async () => {
  const onProject = jest.fn();
  (fetch as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response('one'));
  const { result } = renderHook(() => useProjectDetailLoader('one', onProject));
  await waitFor(() => expect(result.current.loadError).toBeTruthy());
  expect(result.current.isLoading).toBe(false); expect(result.current.fetchComplete).toBe(true);
  act(() => result.current.retryProject());
  await waitFor(() => expect(onProject).toHaveBeenLastCalledWith({ id: 'one' }));
  expect(result.current.loadError).toBeNull();
});
test('late response from a previous project cannot overwrite the current project', async () => {
  let resolveOld!: (value: unknown) => void;
  (fetch as jest.Mock).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce(response('new'));
  const onProject = jest.fn();
  const { rerender } = renderHook(({ id }) => useProjectDetailLoader(id, onProject), { initialProps: { id: 'old' } });
  rerender({ id: 'new' });
  await waitFor(() => expect(onProject).toHaveBeenLastCalledWith({ id: 'new' }));
  await act(async () => resolveOld(response('old')));
  expect(onProject).toHaveBeenLastCalledWith({ id: 'new' });
  expect((fetch as jest.Mock).mock.calls[0][1].signal.aborted).toBe(true);
});
test('disabled loading clears prior project and does not spin forever', async () => {
  (fetch as jest.Mock).mockResolvedValue(response('one'));
  const onProject = jest.fn();
  const { result, rerender } = renderHook(({ enabled }) => useProjectDetailLoader('one', onProject, enabled), { initialProps: { enabled: true } });
  await waitFor(() => expect(onProject).toHaveBeenLastCalledWith({ id: 'one' }));
  rerender({ enabled: false });
  expect(onProject).toHaveBeenLastCalledWith(null);
  expect(result.current).toMatchObject({ isLoading: false, fetchComplete: true });
});
test('malformed success payload is retryable rather than misreported as missing', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  const { result } = renderHook(() => useProjectDetailLoader('one', jest.fn()));
  await waitFor(() => expect(result.current.loadError).toBeTruthy());
  expect(result.current.isLoading).toBe(false);
});


test.each(['authenticated', 'public'] as const)('%s project view uses the matching API access path', async (access) => {
  (fetch as jest.Mock).mockResolvedValue(response('one'));
  const onProject = jest.fn();
  renderHook(() => useProjectDetailLoader('one', onProject, true, access));
  await waitFor(() => expect(onProject).toHaveBeenLastCalledWith({ id: 'one' }));
  expect(fetch).toHaveBeenCalledWith(`/api/projects?projectId=one${access === 'public' ? '&public=true' : ''}`, expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

test('public access denial is not retried as a privileged authenticated fetch', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'Project not found' }) });
  const onProject = jest.fn();
  const { result } = renderHook(() => useProjectDetailLoader('private-draft', onProject, true, 'public'));
  await waitFor(() => expect(result.current.fetchComplete).toBe(true));
  expect(onProject).toHaveBeenLastCalledWith(null);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect((fetch as jest.Mock).mock.calls[0][0]).toContain('&public=true');
});
