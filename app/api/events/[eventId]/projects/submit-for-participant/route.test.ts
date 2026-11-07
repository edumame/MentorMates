/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from './route';
import { createSupabaseClient } from '@/app/utils/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { ORGANIZER_ON_BEHALF_SUBMISSION_OVERRIDES, saveProjectSubmission } from '@/lib/projects/submission-service';
jest.mock('@/app/utils/supabase/server', () => ({ createSupabaseClient: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: jest.fn() }));
jest.mock('@/lib/projects/submission-service', () => ({ ...jest.requireActual('@/lib/projects/submission-service'), saveProjectSubmission: jest.fn() }));
jest.mock('@/lib/integrations/contextus', () => ({ createContextusProject: jest.fn() }));
const participant='11111111-1111-4111-8111-111111111111'; const event='22222222-2222-4222-8222-222222222222';
const mockUserRole=jest.fn();
let targetRole:{data:unknown,error:unknown}={data:{role:'participant'},error:null};
let submissionFields:{data:unknown,error:unknown}={data:[],error:null};
const service = { from: (table:string) => {
 const result=table==='user_profiles' ? {data:{uid:participant,email:'participant@example.test',display_name:'Participant'},error:null} : table==='event_submission_fields' ? submissionFields : targetRole;
 const chain:Record<string,unknown>={}; for(const name of ['select','eq','maybeSingle','overrideTypes']) chain[name]=() => chain;
 chain.then=(resolve:(value:unknown)=>void)=>resolve(result); return chain;
} };
beforeEach(() => {
 jest.clearAllMocks(); targetRole={data:{role:'participant'},error:null}; submissionFields={data:[],error:null}; mockUserRole.mockResolvedValue({data:{role:'organizer'},error:null});
 const chain:Record<string,unknown>={}; for(const name of ['select','eq']) chain[name]=()=>chain; chain.maybeSingle=mockUserRole;
 jest.mocked(createSupabaseClient).mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'organizer'}},error:null})},from:()=>chain,rpc:async()=>({data:false,error:null})} as never);
 jest.mocked(createSupabaseServiceClient).mockReturnValue(service as never);
 jest.mocked(saveProjectSubmission).mockResolvedValue({status:200,project:{id:'project',project_name:'Example'}} as never);
});
const defaultBody=()=>({participant_user_id:participant,project:{project_name:'Example',project_description:'Description',submission_answers:[] as unknown[]}});
const run=(body:Record<string,unknown>=defaultBody())=>POST(new NextRequest('https://example.test/api/submit',{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({eventId:event})});
const requiredFieldId='33333333-3333-4333-8333-333333333333';
const field=(overrides:Record<string,unknown>)=>({id:requiredFieldId,event_id:event,key:'demo_link',label:'Demo link',field_type:'url',required:true,is_active:true,allows_multiple_entries:false,sort_order:2,options:[],description:null,placeholder:null,max_files:null,...overrides});
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

describe('submission deadline',()=>{
 it('passes the server-side organizer override so organizers can submit after the cutoff',async()=>{
  jest.mocked(saveProjectSubmission).mockResolvedValue({status:200,project:{id:'project',project_name:'Example'},submittedAfterDeadline:true} as never);
  const response=await run(); const json=await response.json();
  expect(response.status).toBe(201); expect(json.submitted_after_deadline).toBe(true); expect(json.message).toContain('after the submission deadline');
  expect(jest.mocked(saveProjectSubmission).mock.calls[0][1].overrides).toBe(ORGANIZER_ON_BEHALF_SUBMISSION_OVERRIDES);
  expect(ORGANIZER_ON_BEHALF_SUBMISSION_OVERRIDES).toEqual({allowAfterDeadline:true}); expect(Object.isFrozen(ORGANIZER_ON_BEHALF_SUBMISSION_OVERRIDES)).toBe(true);
 });
 it('reports on-time submissions as not late',async()=>{
  const json=await (await run()).json(); expect(json.submitted_after_deadline).toBe(false); expect(json.message).not.toContain('deadline');
 });
 it('ignores override-looking keys in the request body',async()=>{
  const body=defaultBody(); const response=await run({...body,overrides:{allowAfterDeadline:false,somethingElse:true},allowAfterDeadline:false,project:{...body.project,allowAfterDeadline:false,overrides:{x:1}}});
  expect(response.status).toBe(201);
  const options=jest.mocked(saveProjectSubmission).mock.calls[0][1];
  expect(options.overrides).toBe(ORGANIZER_ON_BEHALF_SUBMISSION_OVERRIDES);
  expect(options.input).not.toHaveProperty('allowAfterDeadline'); expect(options.input).not.toHaveProperty('overrides');
 });
 it('does not let participant callers reach the override at all',async()=>{
  mockUserRole.mockResolvedValue({data:{role:'participant'},error:null});
  expect((await run()).status).toBe(403); expect(saveProjectSubmission).not.toHaveBeenCalled();
 });
});

describe('required submission answers',()=>{
 it('rejects a submission missing a required configured answer, like the participant publish check',async()=>{
  submissionFields={data:[field({})],error:null};
  const response=await run(); expect(response.status).toBe(400);
  expect(await response.json()).toEqual({error:'"Demo link" is required',code:'required_submission_answer_missing',field_id:requiredFieldId});
  expect(saveProjectSubmission).not.toHaveBeenCalled();
 });
 it('treats whitespace-only and unchecked checkbox answers as missing',async()=>{
  submissionFields={data:[field({field_type:'checkbox',label:'Agree'})],error:null};
  const body=defaultBody(); body.project.submission_answers=[{eventSubmissionFieldId:requiredFieldId,answer:'false'}];
  expect((await run(body)).status).toBe(400);
  submissionFields={data:[field({})],error:null}; body.project.submission_answers=[{eventSubmissionFieldId:requiredFieldId,answer:'   '}];
  expect((await run(body)).status).toBe(400); expect(saveProjectSubmission).not.toHaveBeenCalled();
 });
 it('accepts and forwards answers when required fields are answered',async()=>{
  submissionFields={data:[field({}),field({id:'44444444-4444-4444-8444-444444444444',key:'project_name',label:'Project name',field_type:'short_text'})],error:null};
  const body=defaultBody(); body.project.submission_answers=[{eventSubmissionFieldId:requiredFieldId,answer:'https://demo.example.test'}];
  expect((await run(body)).status).toBe(201);
  expect(saveProjectSubmission).toHaveBeenCalledWith(service,expect.objectContaining({input:expect.objectContaining({submissionAnswers:body.project.submission_answers})}));
 });
 it('falls back to project name/description for locked built-in fields',async()=>{
  submissionFields={data:[field({key:'project_description',label:'Description',field_type:'long_text'})],error:null};
  expect((await run()).status).toBe(201);
  const body=defaultBody(); body.project.project_description=undefined as never;
  const response=await run(body); expect(response.status).toBe(400); expect((await response.json()).error).toBe('"Description" is required');
 });
 it('ignores inactive, optional and multi-entry fields',async()=>{
  submissionFields={data:[field({is_active:false}),field({id:'55555555-5555-4555-8555-555555555555',required:false}),field({id:'66666666-6666-4666-8666-666666666666',allows_multiple_entries:true})],error:null};
  expect((await run()).status).toBe(201);
 });
 it('lets drafts omit required answers, matching participant drafts',async()=>{
  submissionFields={data:[field({})],error:null};
  expect((await run({...defaultBody(),submit_immediately:false})).status).toBe(201);
  expect(saveProjectSubmission).toHaveBeenCalledWith(service,expect.objectContaining({defaultSubmitted:false}));
 });
 it('fails closed when submission fields cannot be loaded',async()=>{
  submissionFields={data:null,error:{message:'db down'}}; jest.spyOn(console,'error').mockImplementation(()=>{});
  expect((await run()).status).toBe(500); expect(saveProjectSubmission).not.toHaveBeenCalled();
 });
 it('rejects malformed answer payloads before calling the service',async()=>{
  const body=defaultBody(); body.project.submission_answers=[{eventSubmissionFieldId:'not-a-uuid',answer:1}];
  expect((await run(body)).status).toBe(400); expect(saveProjectSubmission).not.toHaveBeenCalled();
 });
});

it.each(['participant','mentor','judge'])('denies %s callers with 403 before touching service credentials',async(role)=>{
 mockUserRole.mockResolvedValue({data:{role},error:null});
 expect((await run()).status).toBe(403); expect(createSupabaseServiceClient).not.toHaveBeenCalled(); expect(saveProjectSubmission).not.toHaveBeenCalled();
});
