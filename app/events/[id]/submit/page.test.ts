/** @jest-environment node */
import Page from './page';
import { redirect } from 'next/navigation';
import { createSupabaseClient } from '@/app/utils/supabase/server';
jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('@/app/utils/supabase/server', () => ({ createSupabaseClient: jest.fn() }));
const getUser = jest.fn();
beforeEach(() => { jest.clearAllMocks(); jest.mocked(createSupabaseClient).mockResolvedValue({ auth: { getUser } } as never); });
it.each([null, { id: 'u' }])('preserves the event target through the auth handoff (%j)', async user => {
 getUser.mockResolvedValue({ data: { user }, error: null });
 await Page({ params: Promise.resolve({ id: 'event/a' }) });
 const target = '/projects/submit?eventId=event%2Fa';
 expect(redirect).toHaveBeenCalledWith(user ? target : `/login?returnUrl=${encodeURIComponent(target)}`);
});
it('requires sign-in when session verification fails', async () => {
 getUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: new Error('expired') });
 await Page({ params: Promise.resolve({ id: 'event' }) });
 expect(redirect).toHaveBeenCalledWith('/login?returnUrl=%2Fprojects%2Fsubmit%3FeventId%3Devent');
});
