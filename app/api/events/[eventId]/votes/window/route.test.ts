/** @jest-environment node */
import { NextRequest } from 'next/server';
import { PATCH } from './route';

const mockRpc = jest.fn();
const mockGetUser = jest.fn();
const mockUpdate = jest.fn();
const mockMaybeSingle = jest.fn();
jest.mock('@/app/utils/supabase/server', () => ({
  createSupabaseClient: async () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: () => ({
      update: (values: unknown) => {
        mockUpdate(values);
        return { eq: () => ({ select: () => ({ maybeSingle: mockMaybeSingle }) }) };
      },
    }),
  }),
}));

const context = { params: Promise.resolve({ eventId: 'event' }) };
const patch = (body: unknown) =>
  new NextRequest('http://localhost/window', { method: 'PATCH', body: typeof body === 'string' ? body : JSON.stringify(body) });

beforeEach(() => {
  mockRpc.mockReset();
  mockUpdate.mockReset();
  mockMaybeSingle.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'org' } }, error: null });
  mockRpc.mockResolvedValue({ data: true, error: null });
  mockMaybeSingle.mockImplementation(async () => ({
    data: { voting_opens_at: mockUpdate.mock.calls[0][0].voting_opens_at, voting_closes_at: mockUpdate.mock.calls[0][0].voting_closes_at },
    error: null,
  }));
});

it('lets an organizer set the window, normalised to UTC instants', async () => {
  const response = await PATCH(patch({ opensAt: '2026-11-08T10:00:00+02:00', closesAt: '2026-11-09T10:00:00Z' }), context);
  expect(response.status).toBe(200);
  expect(mockRpc).toHaveBeenCalledWith('is_event_organizer_or_owner', { p_event_id: 'event', p_user_id: 'org' });
  expect(mockUpdate).toHaveBeenCalledWith({ voting_opens_at: '2026-11-08T08:00:00.000Z', voting_closes_at: '2026-11-09T10:00:00.000Z' });
  expect(await response.json()).toEqual({ success: true, votingOpensAt: '2026-11-08T08:00:00.000Z', votingClosesAt: '2026-11-09T10:00:00.000Z' });
});

it('clears limits with nulls or empty strings', async () => {
  const response = await PATCH(patch({ opensAt: null, closesAt: '' }), context);
  expect(response.status).toBe(200);
  expect(mockUpdate).toHaveBeenCalledWith({ voting_opens_at: null, voting_closes_at: null });
});

it('rejects non-organizers', async () => {
  mockRpc.mockResolvedValue({ data: false, error: null });
  const response = await PATCH(patch({ opensAt: null, closesAt: null }), context);
  expect(response.status).toBe(403);
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('fails closed when the permission check errors', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
  expect((await PATCH(patch({ opensAt: null, closesAt: null }), context)).status).toBe(500);
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('requires sign-in', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await PATCH(patch({ opensAt: null, closesAt: null }), context)).status).toBe(401);
});

it.each([
  ['malformed JSON', '{oops'],
  ['missing fields', {}],
  ['non-string value', { opensAt: 123, closesAt: null }],
  ['invalid date', { opensAt: 'not-a-date', closesAt: null }],
  ['open after close', { opensAt: '2026-11-09T00:00:00Z', closesAt: '2026-11-08T00:00:00Z' }],
  ['open equals close', { opensAt: '2026-11-08T00:00:00Z', closesAt: '2026-11-08T00:00:00Z' }],
])('returns 400 for %s', async (_label, body) => {
  expect((await PATCH(patch(body), context)).status).toBe(400);
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('returns 404 when the event row is not updatable/visible', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  expect((await PATCH(patch({ opensAt: null, closesAt: null }), context)).status).toBe(404);
});

it('returns 500 on update errors', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'check violation' } });
  expect((await PATCH(patch({ opensAt: null, closesAt: null }), context)).status).toBe(500);
});
