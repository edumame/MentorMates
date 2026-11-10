import { NextResponse } from 'next/server';
import { authorizeMeetingRequest } from '@/lib/meetings/route-access';
import { workerHeaders } from '@/lib/meetings/worker';

export async function GET(request: Request) {
  try {
    const meetingId = new URL(request.url).searchParams.get('meetingId');
    const access = await authorizeMeetingRequest(new Request(request.url, {
      method: 'POST', body: JSON.stringify({ meetingId }), headers: request.headers,
    }));
    if (access.response) return access.response;
    const base = process.env.SCREEN_VISION_WORKER_URL;
    if (!base) throw new Error('Worker unavailable');
    const upstream = await fetch(`${base.replace(/\/$/, '')}/captions/stream?meetingId=${encodeURIComponent(access.meeting.id)}`, {
      headers: workerHeaders(), signal: request.signal, cache: 'no-store',
    });
    if (!upstream.ok) throw new Error('Worker rejected stream');
    return new Response(upstream.body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Captions unavailable' }, { status: 502 });
  }
}
