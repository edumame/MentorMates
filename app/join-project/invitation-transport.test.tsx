import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CurrentJoin from './page';
import LegacyJoin from '@/app/projects/join/[id]/[token]/page';
const projectId='11111111-1111-4111-8111-111111111111';
const token='fixture-signed-token';
const mockPush=jest.fn();
const mockProject={id:projectId,project_name:'Fixture project',project_description:'Fixture',lead_name:'Lead',lead_email:'lead@example.invalid',teammates:[],event_id:null,created_at:'2026-01-01'};
jest.mock('next/navigation',()=>({useRouter:()=>({push:mockPush}),useParams:()=>({id:projectId,token}),useSearchParams:()=>new URLSearchParams({project:projectId,token})}));
jest.mock('@/features/user/authentication/redirect/RedirectProvider',()=>({useRedirect:()=>({setReturnUrlFromCurrentLocation:jest.fn()})}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'viewer', email: 'viewer@example.invalid' } } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: mockProject, error: null }) }) }) }),
  },
}));
const originalFetch=global.fetch;
beforeEach(()=>{global.fetch=jest.fn(async(url)=>({ok:true,json:async()=>String(url).includes('verify-invite')?{valid:true,email:'viewer@example.invalid',project:mockProject}:mockProject})) as jest.Mock;});
afterEach(()=>{global.fetch=originalFetch;});
it.each([['current',CurrentJoin],['legacy',LegacyJoin]] as const)('%s invitation forwards token and ID to verified API',async(_name,Component)=>{
 render(<Component/>);
 const button=await screen.findByRole('button',{name:/^join (this )?project$/i});
 await waitFor(()=>expect(button).not.toBeDisabled());
 fireEvent.click(button);
 await waitFor(()=>expect(global.fetch).toHaveBeenCalledWith('/api/projects/join',expect.objectContaining({method:'PUT',body:JSON.stringify({projectId,token})})));
 expect(await screen.findByText('Successfully Joined!')).toBeInTheDocument();
});
it.each([
 ['current',CurrentJoin,'Failed to load project information'],
 ['legacy',LegacyJoin,'Unable to load this invitation. Please try again.'],
] as const)('%s invitation reports a failed preview request without enabling enrollment',async(_name,Component,message)=>{
 global.fetch=jest.fn().mockRejectedValue(new Error('offline'));
 render(<Component/>);
 expect(await screen.findByText(message)).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:/^join (this )?project$/i})).not.toBeInTheDocument();
});
