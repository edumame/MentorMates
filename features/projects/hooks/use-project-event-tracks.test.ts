import { act, renderHook, waitFor } from '@testing-library/react';
import { useProjectEventTracks } from './use-project-event-tracks';
import { fetchEventTracks } from '@/features/projects/client-actions/client-track-update';
jest.mock('@/features/projects/client-actions/client-track-update', () => ({ fetchEventTracks: jest.fn() }));
const fetchTracks = fetchEventTracks as jest.Mock;
beforeEach(() => jest.resetAllMocks());

it.each(['private', 'public'])('%s detail starts without phantom tracks and exposes confirmed tracks', async () => {
  let finish!: (value: unknown) => void;
  fetchTracks.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useProjectEventTracks('event'));
  expect(result.current).toBe(false);
  await act(async () => { finish({ data: [{ track_id: 'track' }], error: null }); });
  expect(result.current).toBe(true);
});

it('resets track availability when leaving an event and ignores late previous responses', async () => {
  let finish!: (value: unknown) => void;
  fetchTracks.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValue({ data: [], error: null });
  const { result, rerender } = renderHook(({ event }: { event: string | null }) => useProjectEventTracks(event), { initialProps: { event: 'old' as string | null } });
  rerender({ event: 'new' });
  await waitFor(() => expect(fetchTracks).toHaveBeenCalledTimes(2));
  await act(async () => { finish({ data: [{}], error: null }); });
  expect(result.current).toBe(false);
  rerender({ event: null });
  expect(result.current).toBe(false);
});

it('does not show a Tracks tab after a failed response', async () => {
  fetchTracks.mockResolvedValue({ data: null, error: { message: 'Unavailable' } });
  const { result } = renderHook(() => useProjectEventTracks('event'));
  await act(async () => {});
  expect(result.current).toBe(false);
});
