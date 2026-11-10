/** @jest-environment node */
type Result = { data: unknown; error: unknown; count?: number };
const results: Record<string, Result> = {};
const mockGetUser = jest.fn();

function chain(table: string) {
  const self: Record<string, unknown> = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (resolve: (v: Result) => unknown) => resolve(results[table] ?? { data: [], error: null });
      return () => self;
    },
  });
  return self;
}
jest.mock('@/app/utils/supabase/server', () => ({
  createSupabaseClient: async () => ({ auth: { getUser: mockGetUser }, from: (table: string) => chain(table) }),
}));
jest.mock('@/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => ({ from: () => chain('user_profiles') }),
}));
jest.mock('@/lib/projects/membership', () => ({
  getUserProjectIds: async () => ({ ids: ['p1'], error: null }),
}));

import { GET } from './route';

beforeEach(() => {
  for (const key of Object.keys(results)) delete results[key];
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  results.feedback = {
    data: [
      { id: 'f1', feedback_text: 'a', created_at: '2026-11-08T00:00:00Z', mentor_name: 'Mia', mentor_id: 'm1', project_id: 'p1' },
      { id: 'f2', feedback_text: 'b', created_at: '2026-11-08T00:00:00Z', mentor_name: null, mentor_id: null, project_id: 'p1' },
    ],
    error: null,
    count: 2,
  };
  results.projects = { data: [{ id: 'p1', project_name: 'QA' }], error: null };
});

it('returns null (initials fallback) instead of a missing placeholder file when the mentor has no avatar (NEW-006)', async () => {
  results.user_profiles = { data: [{ uid: 'm1', avatar_url: null, display_name: 'Mia' }], error: null };
  const res = await GET(new Request('http://localhost/api/feedback'));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.feedback.map((f: { sender: { avatar: unknown } }) => f.sender.avatar)).toEqual([null, null]);
  expect(JSON.stringify(body)).not.toContain('placeholder-avatar');
});

it('keeps a real mentor avatar', async () => {
  results.user_profiles = { data: [{ uid: 'm1', avatar_url: 'https://cdn.example.test/a.png', display_name: 'Mia' }], error: null };
  const body = await (await GET(new Request('http://localhost/api/feedback'))).json();
  expect(body.feedback[0].sender).toMatchObject({ avatar: 'https://cdn.example.test/a.png', name: 'Mia' });
  expect(body.feedback[1].sender).toMatchObject({ avatar: null, name: 'Anonymous' });
});

it('is 401 when signed out', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null } });
  expect((await GET(new Request('http://localhost/api/feedback'))).status).toBe(401);
});
