/** @jest-environment node */
import { requireMeetingAccess } from './access';
import type { SupabaseClient } from '@supabase/supabase-js';
function client(role: string | null, admin = false) {
  const from = (table: string) => {
    const query = { select: () => query, eq: () => query, in: () => query,
      maybeSingle: async () => ({ data: table === 'meetings'
        ? { id: 'meeting', user_id: 'owner', event_id: 'event' }
        : table === 'events' ? { owner_id: 'event-owner' } : role ? { role } : null }),
    };
    return query;
  };
  return { from, rpc: async () => ({ data: admin }) } as unknown as SupabaseClient;
}
test.each(['organizer', 'admin'])('allows authorized event %s', async role => {
  await expect(requireMeetingAccess(client(role), 'staff', 'meeting')).resolves.toMatchObject({ id: 'meeting' });
});
test.each(['participant', 'judge', 'mentor', null])('does not grant provider credentials for unrelated role %s', async role => {
  await expect(requireMeetingAccess(client(role), 'outsider', 'meeting')).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
test('allows event owner and platform administrator', async () => {
  await expect(requireMeetingAccess(client(null), 'event-owner', 'meeting')).resolves.toBeDefined();
  await expect(requireMeetingAccess(client(null, true), 'platform-admin', 'meeting')).resolves.toBeDefined();
});
