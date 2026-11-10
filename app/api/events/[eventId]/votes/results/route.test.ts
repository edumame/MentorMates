/** @jest-environment node */
import { NextRequest } from 'next/server';
import { DELETE } from './route';

const mockRpc = jest.fn();
const mockGetUser = jest.fn();
jest.mock('@/app/utils/supabase/server', () => ({
  createSupabaseClient: async () => ({ auth: { getUser: mockGetUser }, rpc: mockRpc }),
}));

const context = { params: Promise.resolve({ eventId: 'event' }) };
const del = (body: unknown) =>
  new NextRequest('http://localhost/results', { method: 'DELETE', body: typeof body === 'string' ? body : JSON.stringify(body) });

beforeEach(() => {
  mockRpc.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'org' } }, error: null });
});

describe('DELETE (void vote)', () => {
  it('voids through the audited RPC', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });
    const response = await DELETE(del({ projectId: 'p', voterId: 'v', reason: 'self vote' }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, voided: 1 });
    expect(mockRpc).toHaveBeenCalledWith('void_project_vote', { p_event_id: 'event', p_project_id: 'p', p_voter_id: 'v', p_reason: 'self vote' });
  });

  it('returns 404 when no vote matched', async () => {
    mockRpc.mockResolvedValue({ data: 0, error: null });
    expect((await DELETE(del({ projectId: 'p', voterId: 'v' }), context)).status).toBe(404);
  });

  it('returns 403 for non-organizers', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Only organizers can void votes' } });
    expect((await DELETE(del({ projectId: 'p', voterId: 'v' }), context)).status).toBe(403);
  });

  it('maps bad ids to 400 and hides other errors', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '22P02', message: 'invalid uuid' } });
    expect((await DELETE(del({ projectId: 'p', voterId: 'v' }), context)).status).toBe(400);
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'detail' } });
    const response = await DELETE(del({ projectId: 'p', voterId: 'v' }), context);
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe('Failed to void vote');
  });

  it.each([['malformed JSON', '{'], ['missing voter', { projectId: 'p' }], ['missing project', { voterId: 'v' }], ['non-string', { projectId: 1, voterId: 'v' }]])(
    'returns 400 for %s',
    async (_label, body) => {
      expect((await DELETE(del(body), context)).status).toBe(400);
      expect(mockRpc).not.toHaveBeenCalled();
    }
  );

  it('requires sign-in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await DELETE(del({ projectId: 'p', voterId: 'v' }), context)).status).toBe(401);
  });
});
