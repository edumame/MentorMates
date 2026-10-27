/** @jest-environment node */
import { GET } from './route';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { sendWelcomeProfileEmail } from '@/lib/email/send-welcome-profile';
jest.mock('@/app/utils/supabase/server', () => ({ createSupabaseClient: jest.fn() }));
jest.mock('@/lib/email/send-welcome-profile', () => ({ sendWelcomeProfileEmail: jest.fn() }));
const single = jest.fn(); const insert = jest.fn(); const exchange = jest.fn();
beforeEach(() => {
 jest.clearAllMocks(); process.env.NEXT_PUBLIC_APP_URL = 'https://example.test';
 exchange.mockResolvedValue({ data: { session: { user: { id: 'u', email: 'person@example.test', user_metadata: { full_name: 'Person' } } } }, error: null });
 single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } }); insert.mockResolvedValue({ error: null });
 jest.mocked(sendWelcomeProfileEmail).mockResolvedValue(undefined);
 jest.mocked(createSupabaseClient).mockResolvedValue({ auth: { exchangeCodeForSession: exchange }, from: () => ({ select: () => ({ eq: () => ({ single }) }), insert }) } as never);
});
const run = () => GET(new Request('https://example.test/auth/callback?code=ok&returnUrl=%2Fevents'));
it('sends welcome only after creating a new profile and preserves the return URL', async () => {
 const response = await run(); expect(insert).toHaveBeenCalledTimes(1);
 expect(sendWelcomeProfileEmail).toHaveBeenCalledWith({ to: 'person@example.test', displayName: 'Person', profileUrl: 'https://example.test/profile/u' });
 expect(response.headers.get('location')).toBe('https://example.test/onboarding?returnUrl=%2Fevents');
});
it('does not send another welcome for an existing profile', async () => {
 single.mockResolvedValue({ data: { uid: 'u', onboarding_metadata: null }, error: null });
 await run(); expect(insert).not.toHaveBeenCalled(); expect(sendWelcomeProfileEmail).not.toHaveBeenCalled();
});
it('continues onboarding when delivery fails', async () => {
 const log = jest.spyOn(console, 'error').mockImplementation(() => {});
 jest.mocked(sendWelcomeProfileEmail).mockRejectedValue(new Error('delivery failed'));
 const response = await run(); expect(response.headers.get('location')).toContain('/onboarding'); log.mockRestore();
});
it('does not send when profile insertion fails', async () => {
 insert.mockResolvedValue({ error: new Error('db') }); const response = await run();
 expect(sendWelcomeProfileEmail).not.toHaveBeenCalled(); expect(response.headers.get('location')).toContain('/auth/auth-code-error');
});
it('does not send or insert for an invalid session', async () => {
 exchange.mockResolvedValue({ data: { session: null }, error: new Error('auth') }); await run();
 expect(insert).not.toHaveBeenCalled(); expect(sendWelcomeProfileEmail).not.toHaveBeenCalled();
});
