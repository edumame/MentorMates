import { act, fireEvent, render, screen } from '@testing-library/react';
import SubmitProjectPage from './page';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();
const mockUnsubscribe = jest.fn();
const mockGetSession = jest.fn();
const mockSetReturnUrl = jest.fn();
let mockAuthCallback: (_event: string, session: unknown) => void;
const session = { user: { id: 'test-user', email: 'qa@example.test', user_metadata: {} } };
jest.mock('next/navigation', () => ({ useSearchParams: () => mockSearchParams, useRouter: () => ({ push: mockPush, replace: mockReplace }) }));
jest.mock('@/features/user/authentication/redirect/RedirectProvider', () => ({ useRedirect: () => ({ setReturnUrlFromCurrentLocation: mockSetReturnUrl }) }));
jest.mock('@/lib/supabase', () => ({ supabase: {
  auth: { getSession: () => mockGetSession(), onAuthStateChange: (callback: typeof mockAuthCallback) => { mockAuthCallback = callback; return { data: { subscription: { unsubscribe: mockUnsubscribe } } }; } },
  from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
} }));
jest.mock('@/features/projects/components/forms/NewProjectSubmissionFormSinglePage', () => ({ NewProjectSubmissionFormSinglePage: ({ onDraftSaved }: { onDraftSaved: (id: string) => void }) => <div>Project editor<button onClick={() => onDraftSaved('33333333-3333-4333-8333-333333333333')}>Simulate persisted draft</button></div> }));
jest.mock('@/components/layout/PageContainer', () => ({ PageContainer: ({ children }: {children: React.ReactNode}) => <div>{children}</div>, PageContent: ({ children }: {children: React.ReactNode}) => <div>{children}</div> }));
jest.mock('@/components/ui/toaster', () => ({ Toaster: () => null }));

describe('project submission authentication gate', () => {
  beforeEach(() => { jest.clearAllMocks(); mockSearchParams = new URLSearchParams(); window.history.replaceState(null, "", "/projects/submit"); mockGetSession.mockResolvedValue({ data: { session: null } }); });
  it('never exposes the editor before authentication resolves and preserves the complete return URL', async () => {
    let finish!: (value: unknown) => void;
    mockGetSession.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    mockSetReturnUrl.mockReturnValue('/projects/submit?eventId=qa-event&source=invite#details');
    render(<SubmitProjectPage />);
    expect(screen.queryByText('Project editor')).not.toBeInTheDocument();
    await act(async () => { finish({ data: { session: null } }); });
    expect(screen.queryByText('Project editor')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to continue' }));
    expect(mockPush).toHaveBeenCalledWith('/login?returnUrl=%2Fprojects%2Fsubmit%3FeventId%3Dqa-event%26source%3Dinvite%23details');
  });
  it('retains the editor but disables it when a session expires and unsubscribes on unmount', async () => {
    mockGetSession.mockResolvedValue({ data: { session } });
    const { unmount } = render(<SubmitProjectPage />);
    expect(await screen.findByText('Project editor')).toBeVisible();
    await act(async () => { mockAuthCallback('SIGNED_OUT', null); });
    expect(screen.getByText('Project editor').closest('fieldset')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('changes are not being saved');
    expect(screen.getByRole('link', { name: /Sign in again/ })).toHaveAttribute('target', '_blank');
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
  it('does not restore a stale session after a sign-out event wins the initial lookup race', async () => {
    let finish!: (value: unknown) => void;
    mockGetSession.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<SubmitProjectPage />);
    await act(async () => { mockAuthCallback('SIGNED_OUT', null); finish({ data: { session } }); });
    expect(screen.queryByText('Project editor')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in to continue' })).toBeVisible();
  });
  it('resumes a saved draft from the entry URL after authentication instead of showing a blank creation form', async () => {
    mockSearchParams = new URLSearchParams('draftId=33333333-3333-4333-8333-333333333333');
    mockGetSession.mockResolvedValue({ data: { session } });
    await act(async () => { render(<SubmitProjectPage />); });
    expect(mockReplace).toHaveBeenCalledWith('/projects/33333333-3333-4333-8333-333333333333/edit');
    expect(screen.queryByText('Project editor')).not.toBeInTheDocument();
  });

  it('records saved identity without remounting the editor or dropping URL context', async () => {
    mockGetSession.mockResolvedValue({ data: { session } });
    window.history.replaceState(null, '', '/projects/submit?source=invite#details');
    const { rerender } = render(<SubmitProjectPage />);
    await screen.findByText('Project editor');
    fireEvent.click(screen.getByRole('button', { name: 'Simulate persisted draft' }));
    expect(window.location.search).toBe('?source=invite&draftId=33333333-3333-4333-8333-333333333333');
    expect(window.location.hash).toBe('#details');
    mockSearchParams = new URLSearchParams(window.location.search);
    rerender(<SubmitProjectPage />);
    expect(screen.getByText('Project editor')).toBeVisible();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not rewrite another route when a pending save finishes after navigation', async () => {
    mockGetSession.mockResolvedValue({ data: { session } });
    render(<SubmitProjectPage />);
    await screen.findByText('Project editor');
    window.history.replaceState(null, '', '/projects?event=other');
    fireEvent.click(screen.getByRole('button', { name: 'Simulate persisted draft' }));
    expect(window.location.pathname + window.location.search).toBe('/projects?event=other');
  });

});
