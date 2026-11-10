/** @jest-environment node */
import { NextRequest } from 'next/server';
import { DELETE, GET, POST } from './route';

type Result = { data: unknown; error: unknown };
const results: Record<string, Result> = {};
const serviceResults: Record<string, Result> = {};
const mockInsert = jest.fn();
const mockServiceUpdate = jest.fn();
const mockDelete = jest.fn();
const mockRpc = jest.fn();

function chain(result: () => Result, extra: Record<string, unknown> = {}) {
  const self: Record<string, unknown> = new Proxy({}, {
    get(_t, prop) {
      if (prop in extra) return extra[prop as string];
      if (prop === 'then') return (resolve: (v: Result) => unknown) => resolve(result());
      return () => self;
    },
  });
  return self;
}

jest.mock('@/app/utils/supabase/server', () => ({
  createSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'mentor' } }, error: null }) },
    rpc: mockRpc,
    from: (table: string) => chain(() => results[table] ?? { data: null, error: null }, {
      insert: (row: unknown) => { mockInsert(row); return chain(() => results.insert); },
      delete: () => { mockDelete(table); return chain(() => ({ data: null, error: null })); },
    }),
  }),
}));
jest.mock('@/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => ({
    from: (table: string) => chain(() => serviceResults[table] ?? { data: [], error: null }, {
      update: (values: unknown) => { mockServiceUpdate(table, values); return chain(() => ({ data: null, error: null })); },
    }),
  }),
}));

const context = { params: Promise.resolve({ eventId: 'event' }) };
const hour = 3600_000;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
const post = (start: string, end: string) =>
  POST(new NextRequest('http://localhost/a', { method: 'POST', body: JSON.stringify({ start_time: start, end_time: end }) }), context);

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(results)) delete results[key];
  for (const key of Object.keys(serviceResults)) delete serviceResults[key];
  results.user_event_roles = { data: { role: 'mentor' }, error: null };
  results.events = { data: { submission_time_start: iso(-hour), submission_time_cutoff: iso(48 * hour) }, error: null };
  results.mentor_availability = { data: [], error: null };
  results.insert = { data: { id: 'new' }, error: null };
});

describe('POST availability rules (MENT-003)', () => {
  it('creates a one-hour future slot', async () => {
    expect((await post(iso(2 * hour), iso(3 * hour))).status).toBe(201);
    expect(mockInsert).toHaveBeenCalled();
  });
  it.each([
    ['in the past', -3 * hour, -2 * hour, /past/],
    ['longer than 8 hours', hour, 10 * hour, /8 hours/],
    ['far before the event', -5 * 24 * hour, -5 * 24 * hour + hour, /past|before/],
    ['far after the event', 10 * 24 * hour, 10 * 24 * hour + hour, /after the event/],
  ])('rejects a slot %s', async (_label, start, end, message) => {
    const response = await post(iso(start), iso(end));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(message);
    expect(mockInsert).not.toHaveBeenCalled();
  });
  it('rejects overlap with an existing own slot', async () => {
    results.mentor_availability = { data: [{ id: 'existing' }], error: null };
    expect((await post(iso(2 * hour), iso(3 * hour))).status).toBe(409);
    expect(mockInsert).not.toHaveBeenCalled();
  });
  it('maps the DB guard (race backstop) to 409', async () => {
    results.insert = { data: null, error: { code: '23P01', message: 'This overlaps one of your existing availability slots' } };
    expect((await post(iso(2 * hour), iso(3 * hour))).status).toBe(409);
  });
  it('accepts slots without a configured event window', async () => {
    results.events = { data: { submission_time_start: null, submission_time_cutoff: null }, error: null };
    expect((await post(iso(30 * 24 * hour), iso(30 * 24 * hour + hour))).status).toBe(201);
  });
});

describe('DELETE availability with bookings (MENT-005)', () => {
  const del = (force = false) => DELETE(new NextRequest(`http://localhost/a?id=slot${force ? '&force=true' : ''}`, { method: 'DELETE' }), context);
  beforeEach(() => {
    serviceResults.mentor_availability = { data: { id: 'slot', mentor_id: 'mentor', event_id: 'event' }, error: null };
  });
  it('refuses to silently cancel a booked slot (atomic RPC refuses without force)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'This slot has 2 confirmed booking(s)' } });
    serviceResults.mentor_bookings = { data: null, count: 2, error: null } as never;
    const response = await del();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ booking_count: 2 });
    expect(mockRpc).toHaveBeenCalledWith('cancel_mentor_slot', { p_availability_id: 'slot', p_force: false });
    expect(mockDelete).not.toHaveBeenCalled();
  });
  it('cancels through the RPC (no direct delete/update from the route) when forced', async () => {
    mockRpc.mockResolvedValue({ data: [{ participant_id: 'p1' }], error: null });
    const response = await del(true);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ cancelled_booking_count: 1 });
    expect(mockRpc).toHaveBeenCalledWith('cancel_mentor_slot', { p_availability_id: 'slot', p_force: true });
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockServiceUpdate).not.toHaveBeenCalled();
  });
  it('maps RPC permission errors to 403', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'no' } });
    serviceResults.mentor_availability = { data: { id: 'slot', mentor_id: 'mentor', event_id: 'event' }, error: null };
    expect((await del(true)).status).toBe(403);
  });
});

describe('GET availability privacy (MENT-002)', () => {
  it('never selects or returns mentor emails', async () => {
    results.user_event_roles = { data: { role: 'participant' }, error: null };
    serviceResults.mentor_availability = { data: [{ id: 'slot', mentor_id: 'm' }], error: null };
    serviceResults.mentor_bookings = { data: [], error: null };
    serviceResults.user_profiles = { data: [{ uid: 'm', display_name: 'Mentor M', avatar_url: null }], error: null };
    const body = await (await GET(new NextRequest('http://localhost/a'), context)).json();
    expect(body.availability[0].mentor).toEqual({ uid: 'm', display_name: 'Mentor M', avatar_url: null });
  });
});
