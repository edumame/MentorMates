import { streamVideo } from '@/lib/stream-video';

const MAX_TRANSCRIPT_BYTES = 8 * 1024 * 1024;

/** Resolve through the authenticated provider API, never an owner-editable database URL. */
export async function fetchMeetingTranscript(meetingId: string): Promise<string> {
  const { transcriptions } = await streamVideo.video.call('default', meetingId).listTranscriptions();
  const transcript = [...transcriptions].sort((a, b) =>
    new Date(b.end_time).getTime() - new Date(a.end_time).getTime())[0];
  if (!transcript) return '';
  const url = new URL(transcript.url);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Invalid provider transcript URL');
  }
  const response = await fetch(url.toString(), {
    redirect: 'error', signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('Transcript download failed');
  if (Number(response.headers.get('content-length')) > MAX_TRANSCRIPT_BYTES) {
    await response.body?.cancel();
    throw new Error('Transcript exceeds size limit');
  }
  const reader = response.body?.getReader();
  if (!reader) return '';
  let bytes = 0;
  let text = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_TRANSCRIPT_BYTES) {
        await reader.cancel();
        throw new Error('Transcript exceeds size limit');
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
