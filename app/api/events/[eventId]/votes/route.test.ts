/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST, GET, DELETE } from './route';
import { ORGANIZER_VOTING_BLOCK_MESSAGE, JUDGE_VOTING_BLOCK_MESSAGE } from '@/features/voting/utils/voting-permissions';

const mockRpc = jest.fn();
const mockRole = jest.fn();
const mockGetUser = jest.fn();
jest.mock('@/app/utils/supabase/server', () => ({
  createSupabaseClient: async () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockRole }) }) }) }),
  }),
}));

const context = { params: Promise.resolve({ eventId: 'event' }) };
const request = (method = 'POST', body: unknown = { projectId: 'project' }) =>
  new NextRequest('http://localhost/vote', { method, body: typeof body === 'string' ? body : JSON.stringify(body) });
const getRequest = () => new NextRequest('http://localhost/vote');

beforeEach(() => {
  mockRpc.mockReset();
  mockRole.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'viewer' } }, error: null });
  mockRole.mockResolvedValue({ data: { role: 'participant' }, error: null });
});

describe('POST', () => {
  it('uses atomic voting result instead of count-then-insert', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });
    const response = await POST(request(), context);
    expect(await response.json()).toEqual({ success: true, remainingVotes: 1 });
    expect(mockRpc).toHaveBeenCalledWith('cast_project_vote', { p_event_id: 'event', p_project_id: 'project' });
  });

  it('reports transactional cap rejection', async () => {
    mockRpc.mockResolvedValue({ error: { code: '23514', message: 'Vote cap reached' } });
    expect((await POST(request(), context)).status).toBe(400);
  });

  it('does not allow judge to invoke vote mutation', async () => {
    mockRole.mockResolvedValue({ data: { role: 'judge' } });
    const response = await POST(request(), context);
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe(JUDGE_VOTING_BLOCK_MESSAGE);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('does not allow organizers (who see live totals) to vote', async () => {
    mockRole.mockResolvedValue({ data: { role: 'organizer' }, error: null });
    const response = await POST(request(), context);
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe(ORGANIZER_VOTING_BLOCK_MESSAGE);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('forwards own-project and closed-window rejections from the database as 403', async () => {
    mockRpc.mockResolvedValueOnce({ error: { code: '42501', message: 'You cannot vote for your own project' } });
    let response = await POST(request(), context);
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('You cannot vote for your own project');

    mockRpc.mockResolvedValueOnce({ error: { code: '42501', message: 'Voting has closed' } });
    response = await POST(request(), context);
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('Voting has closed');
  });

  it('rejects drafts/private projects as a bad request', async () => {
    mockRpc.mockResolvedValue({ error: { code: '22023', message: 'Project is not open for voting in this event' } });
    const response = await POST(request(), context);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Project is not open for voting in this event');
  });

  it('hides unexpected database errors', async () => {
    mockRpc.mockResolvedValue({ error: { code: 'XX000', message: 'internal detail' } });
    const response = await POST(request(), context);
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe('Failed to cast vote');
  });

  it('returns 400 for malformed or missing projectId', async () => {
    expect((await POST(request('POST', '{not json'), context)).status).toBe(400);
    expect((await POST(request('POST', {}), context)).status).toBe(400);
    expect((await POST(request('POST', { projectId: 42 }), context)).status).toBe(400);
    expect((await POST(request('POST', { projectId: '   ' }), context)).status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('requires sign-in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request(), context)).status).toBe(401);
  });
});

describe('GET', () => {
  it('preserves aggregate totals beyond PostgREST row limit and own allowance', async () => {
    mockRpc.mockResolvedValue({ data: { voteCounts: { project: 2500 }, userVotes: ['a', 'b', 'c'] }, error: null });
    const result = await GET(getRequest(), context);
    expect(await result.json()).toMatchObject({ voteCounts: { project: 2500 }, remainingVotes: 0, userVotes: ['a', 'b', 'c'] });
  });

  it('returns no totals when the summary withholds them (non-organizers)', async () => {
    mockRpc.mockResolvedValue({ data: { voteCounts: {}, userVotes: ['a'], ownProjectIds: ['mine'] }, error: null });
    const body = await (await GET(getRequest(), context)).json();
    expect(body).toMatchObject({ voteCounts: {}, userVotes: ['a'], ownProjectIds: ['mine'], canVote: true, remainingVotes: 2, votingStatus: 'open' });
  });

  it('serves anonymous callers without totals or voting rights', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockRpc.mockResolvedValue({ data: { voteCounts: {}, userVotes: [] }, error: null });
    const body = await (await GET(getRequest(), context)).json();
    expect(body).toMatchObject({ voteCounts: {}, canVote: false, remainingVotes: 0, ownProjectIds: [] });
    expect(mockRole).not.toHaveBeenCalled();
  });

  it('closes voting outside the window', async () => {
    mockRpc.mockResolvedValue({
      data: { voteCounts: {}, userVotes: [], votingOpensAt: null, votingClosesAt: '2000-01-01T00:00:00Z' },
      error: null,
    });
    const body = await (await GET(getRequest(), context)).json();
    expect(body).toMatchObject({ canVote: false, remainingVotes: 0, votingStatus: 'closed', blockedReason: 'Voting has closed.' });
  });

  it('reports a not-yet-open window', async () => {
    mockRpc.mockResolvedValue({
      data: { voteCounts: {}, userVotes: [], votingOpensAt: '2999-01-01T00:00:00Z', votingClosesAt: null },
      error: null,
    });
    const body = await (await GET(getRequest(), context)).json();
    expect(body.canVote).toBe(false);
    expect(body.votingStatus).toBe('not_open');
    expect(body.blockedReason).toMatch(/^Voting opens /);
  });

  it('prefers the role reason over the window reason', async () => {
    mockRole.mockResolvedValue({ data: { role: 'judge' }, error: null });
    mockRpc.mockResolvedValue({ data: { voteCounts: {}, userVotes: [], votingClosesAt: '2000-01-01T00:00:00Z' }, error: null });
    const body = await (await GET(getRequest(), context)).json();
    expect(body.blockedReason).toBe(JUDGE_VOTING_BLOCK_MESSAGE);
  });

  it('fails closed on summary errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect((await GET(getRequest(), context)).status).toBe(500);
  });

  it('fails closed when the role lookup errors', async () => {
    mockRole.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect((await GET(getRequest(), context)).status).toBe(500);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('DELETE', () => {
  it('removes the vote through remove_project_vote (window enforced in the database)', async () => {
    mockRpc.mockResolvedValue({ data: 2, error: null });
    const response = await DELETE(request('DELETE'), context);
    expect(await response.json()).toEqual({ success: true, remainingVotes: 2 });
    expect(mockRpc).toHaveBeenCalledWith('remove_project_vote', { p_event_id: 'event', p_project_id: 'project' });
  });

  it('lets a voter whose role changed withdraw their own ballot', async () => {
    mockRole.mockResolvedValue({ data: { role: 'organizer' }, error: null });
    mockRpc.mockResolvedValue({ data: 3, error: null });
    expect((await DELETE(request('DELETE'), context)).status).toBe(200);
  });

  it('returns 403 when voting has closed', async () => {
    mockRpc.mockResolvedValue({ error: { code: '42501', message: 'Voting has closed' } });
    const response = await DELETE(request('DELETE'), context);
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('Voting has closed');
  });

  it('returns 404 for an unknown event', async () => {
    mockRpc.mockResolvedValue({ error: { code: 'P0002', message: 'Event not found' } });
    const response = await DELETE(request('DELETE'), context);
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe('Event not found');
  });

  it('hides unexpected errors and validates input', async () => {
    mockRpc.mockResolvedValue({ error: { code: 'XX000', message: 'detail' } });
    const response = await DELETE(request('DELETE'), context);
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe('Failed to remove vote');
    expect((await DELETE(request('DELETE', {}), context)).status).toBe(400);
  });

  it('requires sign-in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await DELETE(request('DELETE'), context)).status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
