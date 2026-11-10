/** @jest-environment node */
import { POST } from './route';
import { NextRequest } from 'next/server';
import { createSupabaseServiceClient } from '@/app/utils/supabase/server';
import { streamChat } from '@/lib/stream-chat';
import OpenAI from 'openai';
import { isStreamChatConfigured, isStreamVideoConfigured } from '@/lib/stream-config';
jest.mock('@/app/utils/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock('@/lib/stream-video', () => ({ streamVideo: { verifyWebhook: () => true } }));
jest.mock('@/lib/inngest/client', () => ({ inngest: {} }));
jest.mock('@/lib/stream-chat', () => ({ streamChat: { channel: jest.fn(), upsertUser: jest.fn(), getMessage: jest.fn() } }));
const mockResponsesCreate = jest.fn();
jest.mock('openai', () => ({ __esModule: true, default: jest.fn(() => ({ responses: { create: mockResponsesCreate } })) }));
jest.mock('@/lib/stream-config', () => ({ ...jest.requireActual('@/lib/stream-config'), isStreamVideoConfigured: jest.fn(() => true), isStreamChatConfigured: jest.fn(() => true) }));
const request = () => new NextRequest('http://localhost', { method: 'POST', headers: { 'x-signature': 'fixture', 'x-api-key': 'fixture' }, body: JSON.stringify({ type: 'message.new', user: { id: 'user' }, channel_id: 'meeting', message: { id: 'message', text: 'Hello' } }) });
it('releases a failed claim so retry delivers, and completes only after awaited send', async () => {
  (streamChat.getMessage as jest.Mock).mockRejectedValue({ status: 404 });
  const receipts = new Map<string, string>();
  const rpc = jest.fn(async (name, args) => {
    if (name === 'claim_chat_webhook') { if (receipts.get(args.p_message_id) === 'done') return { data: 'completed' }; receipts.set(args.p_message_id,args.p_token); return { data: 'claimed' }; }
    if (args.p_completed) receipts.set(args.p_message_id,'done'); else receipts.delete(args.p_message_id);
    return {};
  });
  (createSupabaseServiceClient as jest.Mock).mockResolvedValue({ rpc, from: (table: string) => {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table === 'meetings' ? { agent_id: 'agent' } : { id: 'agent', name: 'Agent', instructions: 'Fixture' } }) }; return q;
  } });
  const sendMessage = jest.fn().mockRejectedValueOnce(new Error('provider outage')).mockResolvedValue({});
  (streamChat.channel as jest.Mock).mockReturnValue({ watch: async () => {}, query: async () => ({ messages: [] }), sendMessage });
  const ai = { responses: { create: mockResponsesCreate } };
  ai.responses.create.mockResolvedValue({ output_text: 'Reply' });
  await expect(POST(request())).rejects.toThrow('provider outage'); expect(receipts.size).toBe(0);
  expect((await POST(request())).status).toBe(200); expect(receipts.get('message')).toBe('done');
  await POST(request()); expect(sendMessage).toHaveBeenCalledTimes(2);
  expect(sendMessage.mock.calls[0][0].id).toBe(sendMessage.mock.calls[1][0].id);
  expect(rpc).toHaveBeenCalledWith('finish_chat_webhook', expect.objectContaining({ p_completed: false }));
});
it('recovers a delivered reply without regenerating or resending it', async () => {
  const rpc = jest.fn(async (name: string) => name === 'claim_chat_webhook' ? { data: 'claimed' } : {});
  (createSupabaseServiceClient as jest.Mock).mockResolvedValue({ rpc });
  (streamChat.getMessage as jest.Mock).mockResolvedValue({ message: { id: 'persisted-reply' } });
  const ai = { responses: { create: mockResponsesCreate } };
  ai.responses.create.mockClear(); (streamChat.channel as jest.Mock).mockClear();
  expect((await POST(request())).status).toBe(200);
  expect(ai.responses.create).not.toHaveBeenCalled(); expect(streamChat.channel).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith('finish_chat_webhook', expect.objectContaining({ p_completed: true }));
});

it('answers 503 without touching Stream when video keys are missing', async () => {
  (isStreamVideoConfigured as jest.Mock).mockReturnValueOnce(false);
  (createSupabaseServiceClient as jest.Mock).mockClear();
  const response = await POST(new NextRequest('http://localhost', { method: 'POST', body: '{}' }));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Video webhooks are not configured' });
  expect(createSupabaseServiceClient).not.toHaveBeenCalled();
});
it('does not construct OpenAI at import time', async () => {
  (OpenAI as unknown as jest.Mock).mockClear();
  await jest.isolateModulesAsync(async () => { await import('./route'); });
  expect(OpenAI as unknown as jest.Mock).not.toHaveBeenCalled();
});

it('answers 503 for chat events when only chat keys are missing', async () => {
  (isStreamChatConfigured as jest.Mock).mockReturnValueOnce(false);
  (createSupabaseServiceClient as jest.Mock).mockResolvedValue({ rpc: jest.fn(), from: jest.fn() });
  (streamChat.channel as jest.Mock).mockClear();
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Chat webhooks are not configured' });
  expect(streamChat.channel).not.toHaveBeenCalled();
});

it('has no console.log debug output (NEW-004)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const source = require('node:fs').readFileSync(require('node:path').join(process.cwd(), 'app/api/webhook/route.ts'), 'utf8');
  expect(source).not.toMatch(/console\.log\(/);
});
