/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from './route';
const mockRpc=jest.fn();
const mockRole=jest.fn();
jest.mock('@/app/utils/supabase/server',()=>({createSupabaseClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'viewer'}},error:null})},rpc:mockRpc,from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:mockRole})})})})})}));
jest.mock('@/lib/supabase/service',()=>({createSupabaseServiceClient:()=>{throw new Error('Booking creation must use authenticated RPC');}}));
const context={params:Promise.resolve({eventId:'event'})};
const request=()=>new NextRequest('http://localhost/book',{method:'POST',body:JSON.stringify({availability_id:'11111111-1111-4111-8111-111111111111'})});
beforeEach(()=>{mockRpc.mockReset();mockRole.mockResolvedValue({data:{role:'participant'},error:null});});
it.each(['Slot is fully booked','This slot has ended'])('returns conflict without retrying privileged writes: %s',async message=>{mockRpc.mockResolvedValue({data:null,error:{code:'23514',message}});const r=await POST(request(),context);expect(r.status).toBe(409);expect(mockRpc).toHaveBeenCalledTimes(1);});
it('returns authorized atomic booking result',async()=>{mockRpc.mockResolvedValue({data:{id:'booking'},error:null});expect((await POST(request(),context)).status).toBe(201);expect(mockRpc).toHaveBeenCalledWith('book_mentor_slot',{p_event_id:'event',p_availability_id:'11111111-1111-4111-8111-111111111111'});});
it('rejects nonmember before RPC',async()=>{mockRole.mockResolvedValue({data:null});expect((await POST(request(),context)).status).toBe(403);expect(mockRpc).not.toHaveBeenCalled();});
