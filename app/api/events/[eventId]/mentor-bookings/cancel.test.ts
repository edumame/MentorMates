/** @jest-environment node */
import { NextRequest } from 'next/server';
import { DELETE, POST } from './route';

const mockRole = jest.fn();
const mockRpc = jest.fn();
const mockUpdate = jest.fn();
const rows: Record<string, unknown> = {};
jest.mock('@/app/utils/supabase/server', () => ({
  createSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'viewer' } }, error: null }) },
    rpc: mockRpc,
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockRole }) }) }) }),
  }),
}));
jest.mock('@/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: rows[table], error: rows[table] ? null : { code: 'PGRST116' } }) }) }),
      update: (values: unknown) => ({ eq: async (column: string, value: string) => { mockUpdate(table, values, column, value); return { error: null }; } }),
      delete: () => { throw new Error('bookings must not be hard-deleted'); },
    }),
  }),
}));

const context = { params: Promise.resolve({ eventId: 'event' }) };
const del = () => DELETE(new NextRequest('http://localhost/bookings?id=booking-1', { method: 'DELETE' }), context);

beforeEach(() => {
  jest.clearAllMocks();
  rows.mentor_bookings = { id: 'booking-1', participant_id: 'attendee', availability_id: 'slot-1' };
  rows.mentor_availability = { event_id: 'event', mentor_id: 'mentor' };
  mockRole.mockResolvedValue({ data: { role: 'participant' } });
});

it.each([
  ['the participant', 'participant', { participant_id: 'viewer' }, {}],
  ['the slot-owner mentor', 'mentor', {}, { mentor_id: 'viewer' }],
  ['an organizer', 'organizer', {}, {}],
])('lets %s cancel, recording status instead of deleting', async (_label, role, booking, slot) => {
  mockRole.mockResolvedValue({ data: { role } });
  Object.assign(rows.mentor_bookings as object, booking);
  Object.assign(rows.mentor_availability as object, slot);
  expect((await del()).status).toBe(200);
  expect(mockUpdate).toHaveBeenCalledWith('mentor_bookings', { status: 'cancelled' }, 'id', 'booking-1');
});

it('forbids another participant or mentor', async () => {
  mockRole.mockResolvedValue({ data: { role: 'mentor' } });
  expect((await del()).status).toBe(403);
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('rejects a booking from another event', async () => {
  rows.mentor_availability = { event_id: 'other', mentor_id: 'viewer' };
  expect((await del()).status).toBe(400);
  expect(mockUpdate).not.toHaveBeenCalled();
});

it.each(['mentor', 'organizer', 'judge'])('does not let a %s consume participant capacity', async (role) => {
  mockRole.mockResolvedValue({ data: { role } });
  const response = await POST(new NextRequest('http://localhost/book', { method: 'POST', body: JSON.stringify({ availability_id: '11111111-1111-4111-8111-111111111111' }) }), context);
  expect(response.status).toBe(403);
  expect(mockRpc).not.toHaveBeenCalled();
});
