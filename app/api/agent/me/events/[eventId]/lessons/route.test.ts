/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server';
import { GET } from './route';
import { authenticateAgentRequest, requireScope, resolveAgentPathEvent, authorizeAgentEventAccess } from '@/lib/agent/auth';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
jest.mock('@/lib/agent/auth', () => ({ authenticateAgentRequest: jest.fn(), requireScope: jest.fn(), resolveAgentPathEvent: jest.fn(), authorizeAgentEventAccess: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: jest.fn() }));
const range = jest.fn(); const eq = jest.fn();
beforeEach(() => {
 jest.clearAllMocks(); jest.mocked(authenticateAgentRequest).mockResolvedValue({ eventId: 'e' } as never);
 jest.mocked(requireScope).mockReturnValue(null as never); jest.mocked(resolveAgentPathEvent).mockResolvedValue({ eventId: 'e' } as never);
 jest.mocked(authorizeAgentEventAccess).mockResolvedValue({} as never);
 range.mockResolvedValue({ data: [{ id: 'lesson' }], count: 1, error: null });
 eq.mockReturnValue({ order: () => ({ range }) });
 jest.mocked(createSupabaseServiceClient).mockReturnValue({ from: () => ({ select: () => ({ eq }) }) } as never);
});
const run = (query = '') => GET(new NextRequest('https://example.test/api/lessons'+query), { params: Promise.resolve({ eventId: 'e' }) });
it.each(['auth', 'scope', 'access'])('rejects denied %s before querying lessons', async step => {
 const denied = NextResponse.json({ error: 'Denied' }, { status: 403 });
 if(step === 'auth') jest.mocked(authenticateAgentRequest).mockResolvedValue(denied);
 if(step === 'scope') jest.mocked(requireScope).mockReturnValue(denied);
 if(step === 'access') jest.mocked(authorizeAgentEventAccess).mockResolvedValue(denied);
 expect((await run()).status).toBe(403); expect(createSupabaseServiceClient).not.toHaveBeenCalled();
});
it('scopes lessons to the authorized event and caps pagination', async () => {
 const result = await run('?limit=999&offset=2'); expect(eq).toHaveBeenCalledWith('event_id','e'); expect(range).toHaveBeenCalledWith(2,201);
 expect(await result.json()).toEqual({ lessons: [{ id: 'lesson' }], total: 1, limit: 200, offset: 2 });
});
it('uses safe defaults for invalid pagination', async () => { await run('?limit=-5&offset=bad'); expect(range).toHaveBeenCalledWith(0,49); });
it('returns an error rather than an empty success on database failure', async () => {
 const log=jest.spyOn(console,'error').mockImplementation(() => {}); range.mockResolvedValue({ error: new Error('database') });
 expect((await run()).status).toBe(500); log.mockRestore();
});
