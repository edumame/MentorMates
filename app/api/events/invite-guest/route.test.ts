/** @jest-environment node */
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

const mockSend = jest.fn();
const quotaRpc = jest.fn();
jest.mock('@/app/utils/supabase/server', () => ({ createSupabaseClient: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock('resend', () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: (...args: unknown[]) => mockSend(...args) } })) }));

import { POST } from './route';

function userClient(role: string | null) {
  const single = (data: unknown) => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data }) }), single: async () => ({ data }) }) }) });
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    rpc: async () => ({ data: false }),
    from: (table: string) =>
      table === 'user_event_roles'
        ? single(role ? { role } : null)
        : table === 'events'
          ? single({ event_name: 'QA Event', slug: 'qa' })
          : single({ display_name: 'QA Organizer' }),
  };
}

const post = () =>
  POST(new Request('http://localhost/api/events/invite-guest', { method: 'POST', body: JSON.stringify({ eventId: 'ev-1', email: 'guest@example.test' }) }));

beforeEach(() => {
  jest.clearAllMocks();
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({ rpc: quotaRpc });
  mockSend.mockResolvedValue({ error: null });
});

it('reserves the shared invite quota before sending', async () => {
  (createSupabaseClient as jest.Mock).mockResolvedValue(userClient('organizer'));
  quotaRpc.mockResolvedValue({ data: [{ allowed: true, retry_at: null, scope: null }], error: null });
  const res = await post();
  expect(res.status).toBe(200);
  expect(quotaRpc).toHaveBeenCalledWith('consume_invite_quota', { p_inviter_id: 'u1', p_event_id: 'ev-1' });
  expect(mockSend).toHaveBeenCalledTimes(1);
});

it('returns 429 and sends nothing when the quota is exhausted', async () => {
  (createSupabaseClient as jest.Mock).mockResolvedValue(userClient('organizer'));
  quotaRpc.mockResolvedValue({ data: [{ allowed: false, retry_at: new Date(Date.now() + 60_000).toISOString(), scope: 'event' }], error: null });
  const res = await post();
  expect(res.status).toBe(429);
  expect(res.headers.get('Retry-After')).toBeTruthy();
  expect(mockSend).not.toHaveBeenCalled();
});

it('does not consume quota for a caller who may not invite', async () => {
  (createSupabaseClient as jest.Mock).mockResolvedValue(userClient('participant'));
  const res = await post();
  expect(res.status).toBe(403);
  expect(quotaRpc).not.toHaveBeenCalled();
  expect(mockSend).not.toHaveBeenCalled();
});
