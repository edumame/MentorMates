/** @jest-environment node */
import { GET } from './route';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { sendWelcomeProfileEmail } from '@/lib/email/send-welcome-profile';
jest.mock('@/app/utils/supabase/server', () => ({ createSupabaseClient: jest.fn() }));
jest.mock('@/lib/email/send-welcome-profile', () => ({ sendWelcomeProfileEmail: jest.fn() }));
const single = jest.fn(); const insert = jest.fn(); const exchange = jest.fn(); const updateUser = jest.fn();
beforeEach(() => {
 jest.clearAllMocks(); process.env.NEXT_PUBLIC_APP_URL = 'https://example.test';
 exchange.mockResolvedValue({ data: { session: { user: { id: 'u', email: 'person@example.test', user_metadata: { full_name: 'Person' } } } }, error: null });
 single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } }); insert.mockResolvedValue({ error: null });
 jest.mocked(sendWelcomeProfileEmail).mockResolvedValue(undefined); updateUser.mockResolvedValue({ data: {}, error: null });
 jest.mocked(createSupabaseClient).mockResolvedValue({ auth: { exchangeCodeForSession: exchange, updateUser }, from: () => ({ select: () => ({ eq: () => ({ single }) }), insert }) } as never);
});
const run = (query = '') => GET(new Request(`https://example.test/auth/callback?code=ok&returnUrl=%2Fevents${query}`));
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
describe('sign-up consent', () => {
 it('does not touch user metadata when no consent was passed (sign-in)', async () => {
  await run(); expect(updateUser).not.toHaveBeenCalled();
 });
 it('records terms acceptance and marketing opt-in from the OAuth sign-up form', async () => {
  await run('&acceptTerms=1&marketingOptIn=1');
  expect(updateUser).toHaveBeenCalledWith({ data: expect.objectContaining({ terms_accepted_at: expect.any(String), terms_version: expect.any(String), marketing_opt_in: true, marketing_opt_in_at: expect.any(String) }) });
 });
 it('records an explicit marketing opt-out', async () => {
  await run('&acceptTerms=1');
  expect(updateUser).toHaveBeenCalledWith({ data: expect.objectContaining({ marketing_opt_in: false, marketing_opt_in_at: null }) });
 });
 it('ignores marketing opt-in without terms acceptance', async () => {
  await run('&marketingOptIn=1'); expect(updateUser).not.toHaveBeenCalled();
 });
 it('never overwrites an existing terms acceptance', async () => {
  exchange.mockResolvedValue({ data: { session: { user: { id: 'u', email: 'person@example.test', user_metadata: { terms_accepted_at: '2026-01-01T00:00:00.000Z' } } } }, error: null });
  await run('&acceptTerms=1&marketingOptIn=1'); expect(updateUser).not.toHaveBeenCalled();
 });
 it('continues the login flow when recording consent fails', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  updateUser.mockResolvedValue({ data: null, error: new Error('auth') });
  const response = await run('&acceptTerms=1');
  expect(response.headers.get('location')).toBe('https://example.test/onboarding?returnUrl=%2Fevents');
  expect(log).toHaveBeenCalledWith('Error recording sign-up consent:', expect.any(Error)); log.mockRestore();
 });
 it('does not record consent for an invalid session', async () => {
  exchange.mockResolvedValue({ data: { session: null }, error: new Error('auth') });
  await run('&acceptTerms=1'); expect(updateUser).not.toHaveBeenCalled();
 });
});
