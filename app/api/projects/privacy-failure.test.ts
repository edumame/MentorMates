/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from './route';
import { createSupabaseClient } from '@/app/utils/supabase/server';
jest.mock('@/app/utils/supabase/server', () => ({ createSupabaseClient: jest.fn() }));
jest.mock('@/lib/integrations/contextus', () => ({ createContextusProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: jest.fn() }));
it.each(['?projectId=project','?eventId=event'])('fails closed when privacy settings cannot be read: %s', async query => {
 const from=jest.fn((table: string) => {
  const result=table==='events' ? { data: null, error: new Error('unavailable') } : table==='projects' ? { data: {id:'project',event_id:'event',lead_email:'private@example.test'}, error:null } : {data:{role:'participant'},error:null};
  const chain: Record<string, unknown> = {}; for(const key of ['select','eq','single','maybeSingle','overrideTypes']) chain[key]=() => chain;
  chain.then=(resolve: (v: unknown) => void) => resolve(result); return chain;
 });
 jest.mocked(createSupabaseClient).mockResolvedValue({ from, auth:{ getUser:async () => ({data:{user:{id:'viewer',email:'viewer@example.test'}},error:null}) },rpc:async () => ({data:false,error:null}) } as never);
 const response=await GET(new NextRequest('https://example.test/api/projects'+query));
 expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('private@example.test');
});
