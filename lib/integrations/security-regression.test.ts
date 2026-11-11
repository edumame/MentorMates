/** @jest-environment node */
import { POST as vision } from '@/app/api/call/vision/route';
import { POST as pause } from '@/app/api/voice-agent/pause/route';
import { POST as resume } from '@/app/api/voice-agent/resume/route';
import { POST as email } from '@/app/api/email_notification/route';
import { POST as stripeWebhook } from '@/app/api/stripe/route';
import { authorizeMeetingRequest } from '@/lib/meetings/route-access';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { stripe } from '@/lib/stripe/stripe';
import { OpenAI } from 'openai';
import { Resend } from 'resend';
jest.mock('@/lib/meetings/route-access', () => ({ authorizeMeetingRequest: jest.fn() }));
jest.mock('@/app/utils/supabase/server', () => ({ createSupabaseClient: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock('@/lib/stripe/stripe', () => ({ stripe: { webhooks: { constructEvent: jest.fn() } } }));
jest.mock('openai', () => ({ OpenAI: jest.fn() }));
jest.mock('resend', () => ({ Resend: jest.fn() }));
const req = () => new Request('http://localhost', { method: 'POST', body: '{}', headers: { 'stripe-signature': 'fixture' } });
beforeEach(() => { jest.clearAllMocks(); process.env.SCREEN_VISION_WORKER_URL = 'https://worker.invalid'; process.env.SCREEN_VISION_WORKER_SECRET = 'fixture'; });
it.each([vision, pause, resume])('denies anonymous callers before provider work', async handler => {
  (authorizeMeetingRequest as jest.Mock).mockResolvedValue({ response: new Response(null, { status: 401 }) });
  expect((await handler(req())).status).toBe(401);
  expect(OpenAI).not.toHaveBeenCalled();
});
it('denies anonymous email even with truthy getUser data wrapper', async () => {
  (createSupabaseClient as jest.Mock).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: {} }) } });
  expect((await email(req())).status).toBe(401);
  expect(Resend).not.toHaveBeenCalled();
});
it('does not spend AI credits on invalid frame timestamps', async () => {
  (authorizeMeetingRequest as jest.Mock).mockResolvedValue({ meeting: { id: 'fixture' }, body: { ts: 'invalid', imageBase64: 'dGVzdA==' } });
  expect((await vision(req())).status).toBe(400); expect(OpenAI).not.toHaveBeenCalled();
});
it('reports vision persistence failure instead of success', async () => {
  (authorizeMeetingRequest as jest.Mock).mockResolvedValue({ meeting: { id: 'fixture' }, body: { ts: 0, imageBase64: 'dGVzdA==' }, service: { from: () => ({ upsert: async () => ({ error: {} }) }) } });
  (OpenAI as unknown as jest.Mock).mockImplementation(() => ({ responses: { create: async () => ({ output_text: 'test' }) } }));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect((await vision(req())).status).toBe(500); log.mockRestore();
});
it('forwards worker credentials only after access and preserves upstream failure', async () => {
  (authorizeMeetingRequest as jest.Mock).mockResolvedValue({ meeting: { id: 'fixture' } });
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
  expect((await pause(req())).status).toBe(502);
  expect(fetchMock).toHaveBeenCalledWith('https://worker.invalid/session/pause', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fixture' }) }));
  fetchMock.mockRestore();
});
it('routes duplicate Stripe delivery through transactional fulfillment and returns retry on failure', async () => {
  (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({ type: 'checkout.session.completed', data: { object: { id: 'cs_fixture', payment_status: 'paid', payment_intent: 'pi_fixture', metadata: { product_type: 'event' } } } });
  const rpc = jest.fn().mockResolvedValueOnce({ data: 'applied' }).mockResolvedValueOnce({ data: 'duplicate' }).mockResolvedValueOnce({ error: {} });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({ rpc });
  expect((await stripeWebhook(req())).status).toBe(200); expect((await stripeWebhook(req())).status).toBe(200);
  expect((await stripeWebhook(req())).status).toBe(503);
  expect(rpc).toHaveBeenCalledWith('apply_event_checkout', expect.objectContaining({ p_session: 'cs_fixture', p_status: 'paid' }));
});
it('ignores unpaid completions and partial refunds', async () => {
  const rpc = jest.fn(); (createSupabaseServiceClient as jest.Mock).mockReturnValue({ rpc });
  for (const event of [{ type: 'checkout.session.completed', data: { object: { payment_status: 'unpaid' } } }, { type: 'charge.refunded', data: { object: { refunded: false } } }]) {
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(event); expect((await stripeWebhook(req())).status).toBe(200);
  }
  expect(rpc).not.toHaveBeenCalled();
});
it('rejects a nonorganizer before creating an email provider client', async () => {
  (createSupabaseClient as jest.Mock).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) }, rpc: async () => ({ data: false }) });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({});
  const body = { requestId: '123e4567-e89b-42d3-a456-426614174000', eventId: '123e4567-e89b-42d3-a456-426614174001', to: 'person@example.invalid', subject: 'Fixture', html: 'Fixture' };
  expect((await email(new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) }))).status).toBe(403);
  expect(Resend).not.toHaveBeenCalled();
});
it('email retries reuse provider batch key and ignore spoofed sender', async () => {
  (createSupabaseClient as jest.Mock).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) }, rpc: async () => ({ data: true }) });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ in: async () => ({ data: [{ user_profiles: { email: 'person@example.invalid' } }] }) }) }) }) });
  const send = jest.fn().mockResolvedValueOnce({ error: {} }).mockResolvedValue({ error: null });
  (Resend as unknown as jest.Mock).mockImplementation(() => ({ batch: { send } }));
  const body = { requestId: '123e4567-e89b-42d3-a456-426614174000', eventId: '123e4567-e89b-42d3-a456-426614174001', to: 'person@example.invalid', from: 'spoof@example.invalid', subject: 'Fixture', html: 'Fixture' };
  const request = () => new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) });
  expect((await email(request())).status).toBe(422); expect((await email(request())).status).toBe(200);
  expect(send.mock.calls[0][1].idempotencyKey).toBe(send.mock.calls[1][1].idempotencyKey);
  expect(send.mock.calls[0][0][0].from).toBe('MentorMates <notifications@hello.mentormates.ai>');
});
