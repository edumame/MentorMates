import type { NextRequest } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const meetingId = body?.meetingId;
    if (!meetingId || typeof meetingId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid meetingId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    const workerBase = process.env.SCREEN_VISION_WORKER_URL?.replace(/\/$/, '');
    if (!workerBase) {
      console.error('Missing SCREEN_VISION_WORKER_URL');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    const res = await fetch(`${workerBase}/agent/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId }),
    });

    const text = await res.text();
    const contentType = res.headers.get('content-type') || 'application/json';
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('Error proxying /agent/resume', err);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
}
