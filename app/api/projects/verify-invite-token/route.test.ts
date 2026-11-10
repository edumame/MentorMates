/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from './route';
import { generateProjectInviteToken } from '@/lib/utils/jwt';
const mockUser=jest.fn();
const mockSingle=jest.fn();
const mockFrom=jest.fn(()=>({select:jest.fn(()=>({eq:jest.fn(()=>({single:mockSingle}))}))}));
jest.mock('@/app/utils/supabase/server',()=>({createSupabaseClient:async()=>({auth:{getUser:mockUser}})}));
jest.mock('@/lib/supabase/service',()=>({createSupabaseServiceClient:()=>({from:mockFrom})}));
const projectId='11111111-1111-4111-8111-111111111111';
const project={id:projectId,project_name:'Private project',lead_email:'lead@example.test',teammates:[]};
const request=(body:object)=>new NextRequest('http://localhost/api/projects/verify-invite-token',{method:'POST',body:JSON.stringify(body)});
const signed=(email='invitee@example.test',id=projectId,ttl=600)=>generateProjectInviteToken({email,projectId:id,invitedBy:'lead@example.test'},ttl);
beforeEach(()=>{jest.clearAllMocks();process.env.JWT_SECRET='local-invite-test-only-key';mockUser.mockResolvedValue({data:{user:{id:'invitee',email:'invitee@example.test'}}});mockSingle.mockResolvedValue({data:project,error:null});});
it('allows the authenticated addressed invitee to preview the bound private project',async()=>{const response=await POST(request({projectId,token:await signed()}));expect(response.status).toBe(200);expect((await response.json()).project).toEqual(project);});
it('does not return project metadata to a signed-out token holder',async()=>{mockUser.mockResolvedValue({data:{user:null}});const response=await POST(request({projectId,token:await signed()}));expect(await response.json()).toMatchObject({valid:true,project:null});expect(mockFrom).not.toHaveBeenCalled();});
it('rejects an authenticated outsider with another user’s addressed link',async()=>{mockUser.mockResolvedValue({data:{user:{id:'outsider',email:'outsider@example.test'}}});expect((await POST(request({projectId,token:await signed()}))).status).toBe(403);expect(mockFrom).not.toHaveBeenCalled();});
it.each(['missing','forged','expired','wrong-project'])('does not read private metadata for %s tokens',async kind=>{const token=kind==='missing'?'':kind==='forged'?'forged':await signed('invitee@example.test',kind==='wrong-project'?'other-project':projectId,kind==='expired'?-60:600);expect((await POST(request({projectId,token}))).status).toBeGreaterThanOrEqual(400);expect(mockFrom).not.toHaveBeenCalled();});
it('supports existing deliberately shareable links only after login',async()=>{expect((await POST(request({projectId,token:await signed('')}))).status).toBe(200);});
it('rejects a stale inviter even when its signature remains valid',async()=>{mockSingle.mockResolvedValue({data:{...project,lead_email:'replacement@example.test'},error:null});const response=await POST(request({projectId,token:await signed()}));expect(response.status).toBe(403);expect((await response.json()).project).toBeUndefined();});
it('returns a retryable error without project data when lookup fails',async()=>{mockSingle.mockResolvedValue({data:null,error:{code:'XX000'}});expect((await POST(request({projectId,token:await signed()}))).status).toBe(503);});
it.each(['null','[]','"text"','42','{'])('rejects malformed or non-object JSON %s before reading private data',async body=>{
 const response=await POST(new NextRequest('http://localhost/api/projects/verify-invite-token',{method:'POST',body}));
 expect(response.status).toBe(400);
 expect(mockFrom).not.toHaveBeenCalled();
});
