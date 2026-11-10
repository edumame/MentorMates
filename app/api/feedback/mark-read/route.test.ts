/** @jest-environment node */
type Result = { data: unknown; error: unknown };
const results: Record<string, Result> = {};
const mockRpc = jest.fn();
const mockUpsert = jest.fn();
const mockGetUser = jest.fn();

function chain(table: string) {
  const self: Record<string, unknown> = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (resolve: (v: Result) => unknown) => resolve(results[table] ?? { data: [], error: null });
      if (prop === 'upsert') return async (rows: unknown) => { mockUpsert(rows); return results.upsert ?? { error: null }; };
      return () => self;
    },
  });
  return self;
}
jest.mock('@/app/utils/supabase/server', () => ({
  createSupabaseClient: async () => ({ auth: { getUser: mockGetUser }, from: (table: string) => chain(table), rpc: async (name: string, args: unknown) => { mockRpc(name, args); return results.projects; } }),
}));

import { POST } from './route';

const post = (body: unknown) => POST(new Request('http://localhost/api/feedback/mark-read', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(results)) delete results[key];
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'lead@example.test' } } });
  results.projects = { data: ['p1', 'p1', 'p2'], error: null };
  results.feedback = { data: [{ id: 'f1' }, { id: 'f2' }], error: null };
});

it('marks every feedback row on the caller\'s projects (my_project_ids)', async () => {
  const response = await post({ markAll: true });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, marked: 2 });
  expect(mockRpc).toHaveBeenCalledWith('my_project_ids', {});
  expect(mockUpsert).toHaveBeenCalledWith([{ feedback_id: 'f1', user_id: 'u1' }, { feedback_id: 'f2', user_id: 'u1' }]);
});

it('fails loudly instead of reporting success when the project query errors', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  results.projects = { data: null, error: { message: 'column does not exist' } };
  expect((await post({ markAll: true })).status).toBe(500);
  expect(mockUpsert).not.toHaveBeenCalled();
  spy.mockRestore();
});

it('fails when the feedback query errors', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  results.feedback = { data: null, error: { message: 'boom' } };
  expect((await post({ markAll: true })).status).toBe(500);
  spy.mockRestore();
});

it('reports zero marked when there is nothing to mark', async () => {
  results.feedback = { data: [], error: null };
  expect(await (await post({ markAll: true })).json()).toEqual({ success: true, marked: 0 });
  expect(mockUpsert).not.toHaveBeenCalled();
});

it('returns 500 when the upsert fails', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  results.upsert = { data: null, error: { message: 'rls' } };
  expect((await post({ markAll: true })).status).toBe(500);
  spy.mockRestore();
});

it('requires auth', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null } });
  expect((await post({ markAll: true })).status).toBe(401);
});
