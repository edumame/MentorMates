/** @jest-environment node */
import { GET, POST } from './route';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
jest.mock('@/app/utils/supabase/server', () => ({ createSupabaseClient: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: jest.fn() }));
const ticketId='00000000-0000-0000-0000-000000000001';
const context={ params: Promise.resolve({ ticketId }) };
const request=new Request('http://localhost/api/tickets/'+ticketId+'/claim');
const rpc=jest.fn(); const maybeSingle=jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (createSupabaseClient as jest.Mock).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'session-user', email: 'Invitee@example.invalid' } }, error: null }) } });
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({ rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) });
});
test('anonymous claim is rejected before privileged calls', async () => {
  (createSupabaseClient as jest.Mock).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } });
  expect((await POST(request,context)).status).toBe(401); expect(rpc).not.toHaveBeenCalled();
});
test('claim identity comes from session, never request body', async () => {
  rpc.mockResolvedValue({ data: 'event-id', error: null });
  const response=await POST(new Request(request.url,{method:'POST',body:JSON.stringify({userId:'victim'})}),context);
  expect(response.status).toBe(200); expect(rpc).toHaveBeenCalledWith('claim_event_ticket',{p_ticket_id:ticketId,p_user_id:'session-user'});
});
test('capacity rollback is reported as conflict', async () => {
  rpc.mockResolvedValue({data:null,error:{code:'45000'}});
  expect((await POST(request,context)).status).toBe(409);
});
test('ticket metadata never exposes another recipient', async () => {
  maybeSingle.mockResolvedValue({data:{id:ticketId,assigned_to_email:'other@example.invalid',assigned_to_user_id:null,event:{event_name:'Private'}},error:null});
  const response=await GET(request,context);
  expect(response.status).toBe(404); expect(JSON.stringify(await response.json())).not.toContain('Private');
});
test('invited email can read safe claim metadata despite client RLS hiding email-only tickets', async () => {
  maybeSingle.mockResolvedValue({data:{id:ticketId,assigned_to_email:'invitee@example.invalid',assigned_to_user_id:null,event:{event_name:'Invited event'}},error:null});
  expect((await GET(request,context)).status).toBe(200);
});
