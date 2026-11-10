/** @jest-environment node */
import { NextRequest } from 'next/server';
import { PUT } from './route';
import { generateProjectInviteToken } from '@/lib/utils/jwt';
const mockRpc = jest.fn();
jest.mock('@/app/utils/supabase/server', () => ({ createSupabaseClient: async () => ({auth:{getUser:async()=>({data:{user:{id:'user',email:'viewer@example.invalid'}},error:null})}}) }));
jest.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: () => ({rpc:mockRpc}) }));
const projectId='11111111-1111-4111-8111-111111111111';
const request=(body:object)=>new NextRequest('http://localhost/api/projects/join',{method:'PUT',body:JSON.stringify(body)});
beforeEach(()=>{mockRpc.mockReset();process.env.JWT_SECRET='fixture-project-invite-key-with-enough-length';});
it('rejects token-free enrollment before any privileged RPC',async()=>{expect((await PUT(request({projectId}))).status).toBe(400);expect(mockRpc).not.toHaveBeenCalled();});
it.each([{email:'someone@example.invalid',projectId}, {email:'viewer@example.invalid',projectId:'22222222-2222-4222-8222-222222222222'}])('rejects mismatched signed invite %j',async claims=>{const token=await generateProjectInviteToken({...claims,invitedBy:'lead@example.invalid'});expect((await PUT(request({projectId,token}))).status).toBe(403);expect(mockRpc).not.toHaveBeenCalled();});
it('rejects expired signed invitation',async()=>{const token=await generateProjectInviteToken({email:'viewer@example.invalid',projectId,invitedBy:'lead@example.invalid'},-60);expect((await PUT(request({projectId,token}))).status).toBe(403);});
it.each(['viewer@example.invalid',''])('sends validated addressed/shareable invitation to atomic operation',async email=>{const token=await generateProjectInviteToken({email,projectId,invitedBy:'lead@example.invalid'});mockRpc.mockResolvedValue({data:{id:projectId},error:null});expect((await PUT(request({projectId,token}))).status).toBe(200);expect(mockRpc).toHaveBeenCalledWith('accept_project_invitation',{p_project_id:projectId,p_user_id:'user',p_invited_by:'lead@example.invalid'});});
it('preserves database denial of event membership or stale inviter',async()=>{const token=await generateProjectInviteToken({email:'',projectId,invitedBy:'lead@example.invalid'});mockRpc.mockResolvedValue({data:null,error:{code:'42501',message:'Join event first'}});expect((await PUT(request({projectId,token}))).status).toBe(403);});
