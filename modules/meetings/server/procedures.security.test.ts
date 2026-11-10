/** @jest-environment node */
import { meetingsRouter } from './procedures';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { streamVideo } from '@/lib/stream-video';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { streamChat } from '@/lib/stream-chat';
jest.mock('@/app/utils/supabase/server', () => ({ createSupabaseClient: jest.fn(), createSupabaseServiceClient: jest.fn() }));
jest.mock('@/lib/stream-video', () => ({ streamVideo: { upsertUsers: jest.fn(), generateCallToken: jest.fn(() => 'fake-video-token'), video: { call: jest.fn() } } }));
jest.mock('@/lib/stream-chat', () => ({ streamChat: { upsertUsers: jest.fn(), createToken: jest.fn(() => 'fake-chat-token'), channel: jest.fn() } }));
jest.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock('react', () => ({ ...jest.requireActual('react'), cache: (fn: unknown) => fn }));
const id = '10000000-0000-4000-8000-000000000001';
const user = { id: 'ordinary-user', user_metadata: { full_name: 'Fixture' } };
const mockCall = { create: jest.fn(), delete: jest.fn(), listTranscriptions: jest.fn(), get: jest.fn(), updateCallMembers: jest.fn() };
const mockChannel = { create: jest.fn(), addMembers: jest.fn() };
let rows: Record<string, unknown>[];
let owner: string;
let cleanupError: object | null;
function database() {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    rpc: async () => ({ data: false }),
    from: (table: string) => {
      let mode = 'select';
      const q = {
        select: () => q, eq: () => q,
        maybeSingle: async () => ({ data: { id, user_id: owner, transcript_url: 'http://127.0.0.1/private' } }),
        limit: async () => ({ data: table === 'agents' ? [{ id: 'agent', name: 'Fixture' }] : rows }),
        insert: (row: Record<string, unknown>) => { rows.push({ ...row, id }); return q; },
        delete: () => { mode = 'delete'; return q; },
        match: async () => { if (!cleanupError) rows = []; return { error: cleanupError }; },
        in: async () => ({ data: [] }),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: [], count: rows.length, error: mode === 'delete' ? cleanupError : null }),
      };
      return q;
    },
  };
}
beforeEach(() => {
  jest.resetAllMocks(); rows = []; owner = user.id; cleanupError = null;
  (createSupabaseClient as jest.Mock).mockResolvedValue(database());
  (streamVideo.video.call as jest.Mock).mockReturnValue(mockCall);
  (streamVideo.generateCallToken as jest.Mock).mockReturnValue('fake-video-token');
  (streamChat.channel as jest.Mock).mockReturnValue(mockChannel);
});
test('ordinary meeting owner receives user roles and a call-scoped video token', async () => {
  const caller = meetingsRouter.createCaller({});
  await caller.generateToken({ id }); await caller.generateChatToken({ id });
  for (const upsert of [streamVideo.upsertUsers, streamChat.upsertUsers]) {
    expect(upsert).toHaveBeenCalledWith([expect.objectContaining({ id: user.id, role: 'user' })]);
  }
  expect(streamVideo.generateCallToken).toHaveBeenCalledWith({ user_id: user.id, call_cids: [`default:${id}`], validity_in_seconds: 3600 });
  expect(mockChannel.addMembers).toHaveBeenCalledWith([user.id]);
  expect(streamChat.createToken).toHaveBeenCalledWith(user.id, expect.any(Number));
});
test('unrelated user receives no provider credentials or membership', async () => {
  owner = 'another-user';
  const caller = meetingsRouter.createCaller({});
  await expect(caller.generateToken({ id })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await expect(caller.generateChatToken({ id })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(streamVideo.upsertUsers).not.toHaveBeenCalled();
  expect(streamChat.upsertUsers).not.toHaveBeenCalled();
});
test('failed call provisioning cleans remote call and row, then retry consumes one session', async () => {
  mockCall.create.mockRejectedValueOnce(new Error('provider unavailable')).mockResolvedValueOnce({});
  const caller = meetingsRouter.createCaller({});
  await expect(caller.create({ name: 'Fixture', agentId: 'agent' })).rejects.toThrow('Please try again');
  expect(mockCall.delete).toHaveBeenCalledTimes(1); expect(rows).toHaveLength(0);
  await caller.create({ name: 'Fixture', agentId: 'agent' }); expect(rows).toHaveLength(1);
});
test('agent provider failure does not insert a meeting', async () => {
  (streamVideo.upsertUsers as jest.Mock).mockRejectedValue(new Error('provider unavailable'));
  await expect(meetingsRouter.createCaller({}).create({ name: 'Fixture', agentId: 'agent' })).rejects.toThrow();
  expect(rows).toHaveLength(0);
});
test('database compensation failure is surfaced explicitly', async () => {
  mockCall.create.mockRejectedValue(new Error('provider unavailable')); cleanupError = { message: 'database unavailable' };
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try { await expect(meetingsRouter.createCaller({}).create({ name: 'Fixture', agentId: 'agent' })).rejects.toThrow('cleanup requires support'); }
  finally { log.mockRestore(); }
});
test('stored arbitrary URL is never fetched; transcript resolved from provider by meeting id', async () => {
  mockCall.listTranscriptions.mockResolvedValue({ transcriptions: [] });
  const fetchMock = jest.spyOn(global, 'fetch');
  try {
    expect(await meetingsRouter.createCaller({}).getTranscript({ id })).toEqual([]);
    expect(mockCall.listTranscriptions).toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  } finally { fetchMock.mockRestore(); }
});
test('provider membership failures do not attempt duplicate call creation', async () => {
  mockCall.get.mockResolvedValue({}); mockCall.updateCallMembers.mockRejectedValue(new Error('provider unavailable'));
  await expect(meetingsRouter.createCaller({}).ensureCallExists({ id })).rejects.toThrow('provider unavailable');
  expect(mockCall.create).not.toHaveBeenCalled();
});

test('failed remote cleanup retains a non-quota-consuming reconciliation record', async () => {
  mockCall.create.mockRejectedValue(new Error('provider timeout'));
  mockCall.delete.mockRejectedValue(new Error('provider unavailable'));
  const update = jest.fn(() => ({ match: async () => ({ error: null }) }));
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({ from: () => ({ update }) });
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await expect(meetingsRouter.createCaller({}).create({ name: 'Fixture', agentId: 'agent' })).rejects.toThrow('session allowance was restored');
    expect(update).toHaveBeenCalledWith({ provisioning_failed: true, status: 'cancelled' });
    expect(rows).toHaveLength(1);
  } finally { log.mockRestore(); }
});
