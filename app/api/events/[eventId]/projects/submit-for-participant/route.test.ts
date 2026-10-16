/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from './route';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { saveProjectSubmission } from '@/lib/projects/submission-service';
jest.mock('@/app/utils/supabase/server', () => ({ createSupabaseClient: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock('@/lib/projects/submission-service', () => ({ ...jest.requireActual('@/lib/projects/submission-service'), saveProjectSubmission: jest.fn() }));
jest.mock('@/lib/integrations/contextus', () => ({ createContextusProject: jest.fn() }));
const participant='11111111-1111-4111-8111-111111111111'; const event='22222222-2222-4222-8222-222222222222';
const mockUserRole=jest.fn();
const service = { from: (table:string) => {
 const data=table==='user_profiles' ? {uid:participant,email:'participant@example.test',display_name:'Participant'} : {role:'participant'};
 const chain:Record<string,unknown>={}; for(const name of ['select','eq','maybeSingle']) chain[name]=() => chain;
 chain.then=(resolve:(value:unknown)=>void)=>resolve({data,error:null}); return chain;
} };
beforeEach(() => {
 jest.clearAllMocks(); mockUserRole.mockResolvedValue({data:{role:'organizer'},error:null});
 const chain:Record<string,unknown>={}; for(const name of ['select','eq']) chain[name]=()=>chain; chain.maybeSingle=mockUserRole;
 jest.mocked(createSupabaseClient).mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'organizer'}},error:null})},from:()=>chain,rpc:async()=>({data:false,error:null})} as never);
 jest.mocked(createSupabaseServiceClient).mockReturnValue(service as never);
 jest.mocked(saveProjectSubmission).mockResolvedValue({status:200,project:{id:'project',project_name:'Example'}} as never);
});
const run=()=>POST(new NextRequest('https://example.test/api/submit',{method:'POST',body:JSON.stringify({participant_user_id:participant,project:{project_name:'Example',project_description:'Description',submission_answers:[]}})}),{params:Promise.resolve({eventId:event})});
it('uses the shared service with the participant identity and event', async()=>{
 expect((await run()).status).toBe(201);
 expect(saveProjectSubmission).toHaveBeenCalledWith(service,expect.objectContaining({mode:'create',input:expect.objectContaining({eventId:event,leadEmail:'participant@example.test',submissionAnswers:[],submitted:true})}));
});
it('propagates validation failures without returning a false success',async()=>{
 jest.mocked(saveProjectSubmission).mockResolvedValue({status:400,error:'Invalid submission field IDs'} as never);
 const response=await run(); expect(response.status).toBe(400); expect(await response.json()).toEqual({error:'Invalid submission field IDs'});
});
it('propagates persistence failures',async()=>{
 jest.mocked(saveProjectSubmission).mockResolvedValue({status:500,error:'Failed to create project track relationships'} as never);
 expect((await run()).status).toBe(500);
});
it('denies unauthorized event roles before invoking service credentials',async()=>{
 mockUserRole.mockResolvedValue({data:{role:'participant'},error:null}); expect((await run()).status).toBe(403); expect(createSupabaseServiceClient).not.toHaveBeenCalled();
});
