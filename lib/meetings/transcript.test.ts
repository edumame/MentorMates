/** @jest-environment node */
import { fetchMeetingTranscript } from './transcript';
import { streamVideo } from '@/lib/stream-video';
jest.mock('@/lib/stream-video', () => ({ streamVideo: { video: { call: jest.fn() } } }));
const listTranscriptions = jest.fn();
beforeEach(() => { jest.clearAllMocks(); (streamVideo.video.call as jest.Mock).mockReturnValue({ listTranscriptions }); });
test('downloads latest provider transcription with redirect rejection and timeout', async () => {
  listTranscriptions.mockResolvedValue({ transcriptions: [
    { url: 'https://provider.invalid/old', end_time: '2026-01-01' },
    { url: 'https://provider.invalid/latest', end_time: '2026-02-01' },
  ] });
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('transcript'));
  try {
    expect(await fetchMeetingTranscript('meeting')).toBe('transcript');
    expect(fetchMock).toHaveBeenCalledWith('https://provider.invalid/latest', expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }));
  } finally { fetchMock.mockRestore(); }
});
test.each(['http://127.0.0.1/private', 'https://user:password@provider.invalid/file'])('rejects invalid provider URL %s', async url => {
  listTranscriptions.mockResolvedValue({ transcriptions: [{ url, end_time: '2026-01-01' }] });
  const fetchMock = jest.spyOn(global, 'fetch');
  try { await expect(fetchMeetingTranscript('meeting')).rejects.toThrow('Invalid provider'); expect(fetchMock).not.toHaveBeenCalled(); }
  finally { fetchMock.mockRestore(); }
});
test('bounds body even without Content-Length', async () => {
  listTranscriptions.mockResolvedValue({ transcriptions: [{ url: 'https://provider.invalid/file', end_time: '2026-01-01' }] });
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(new Uint8Array(8 * 1024 * 1024 + 1)));
  try { await expect(fetchMeetingTranscript('meeting')).rejects.toThrow('size limit'); }
  finally { fetchMock.mockRestore(); }
});
