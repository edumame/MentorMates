/** @jest-environment node */
const mockSave = jest.fn();
const mockAccess = jest.fn();
jest.mock('@/app/utils/supabase/server', () => ({
  createSupabaseClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'outsider@example.test' } }, error: null }) } }),
}));
jest.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: () => ({}) }));
jest.mock('@/lib/projects/access', () => ({ getProjectEditAccess: (...args: unknown[]) => mockAccess(...args) }));
jest.mock('@/lib/projects/submission-service', () => ({
  normalizeProjectWriteInput: (body: Record<string, unknown>) => ({ success: true, data: body }),
  saveProjectSubmission: (...args: unknown[]) => mockSave(...args),
}));
import { POST } from './route';

const post = (body: object) => POST(new Request('http://localhost/api/projects/submit', { method: 'POST', body: JSON.stringify(body) }));
beforeEach(() => { jest.clearAllMocks(); mockSave.mockResolvedValue({ project: { id: 'p1' } }); });

it('rejects a non-member update with 403 before writing (PUB-011)', async () => {
  mockAccess.mockResolvedValue({ access: { canEdit: false } });
  expect((await post({ projectId: 'p1', projectName: 'x' })).status).toBe(403);
  expect(mockSave).not.toHaveBeenCalled();
});

it('returns 404 for an unknown project', async () => {
  mockAccess.mockResolvedValue({ access: null, error: 'Project not found', status: 404 });
  expect((await post({ projectId: 'nope' })).status).toBe(404);
  expect(mockSave).not.toHaveBeenCalled();
});

it('lets a member update', async () => {
  mockAccess.mockResolvedValue({ access: { canEdit: true } });
  expect((await post({ projectId: 'p1' })).status).toBe(200);
});

it('does not require edit access to create', async () => {
  expect((await post({ projectName: 'new' })).status).toBe(200);
  expect(mockAccess).not.toHaveBeenCalled();
});

it('passes through the 403 for a zero-row RLS update', async () => {
  mockAccess.mockResolvedValue({ access: { canEdit: true } });
  mockSave.mockResolvedValue({ error: "You don't have permission to edit this project", status: 403 });
  expect((await post({ projectId: 'p1' })).status).toBe(403);
});
