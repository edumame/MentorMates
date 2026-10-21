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
let targetRole:{data:unknown,error:unknown}={data:{role:'participant'},error:null};
const service = { from: (table:string) => {
 const result=table==='user_profiles' ? {data:{uid:participant,email:'participant@example.test',display_name:'Participant'},error:null} : targetRole;
 const chain:Record<string,unknown>={}; for(const name of ['select','eq','maybeSingle']) chain[name]=() => chain;
 chain.then=(resolve:(value:unknown)=>void)=>resolve(result); return chain;
} };
beforeEach(() => {
 jest.clearAllMocks(); targetRole={data:{role:'participant'},error:null}; mockUserRole.mockResolvedValue({data:{role:'organizer'},error:null});
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
it.each(['mentor','judge','organizer','admin'])('refuses to create a project for a %s',async(role)=>{
 targetRole={data:{role},error:null};
 const response=await run(); expect(response.status).toBe(400); expect(await response.json()).toEqual({error:'User is not a participant of this event'}); expect(saveProjectSubmission).not.toHaveBeenCalled();
});
it('refuses users with no role in the event',async()=>{
 targetRole={data:null,error:null};
 expect((await run()).status).toBe(400); expect(saveProjectSubmission).not.toHaveBeenCalled();
});
it('fails closed when the participant role lookup errors',async()=>{
 targetRole={data:null,error:{message:'db down'}};
 jest.spyOn(console,'error').mockImplementation(()=>{});
 expect((await run()).status).toBe(500); expect(saveProjectSubmission).not.toHaveBeenCalled();
});
