import { act, render, screen } from '@testing-library/react';
import { AuthContextProvider, useAuth } from '@/features/user/authentication/auth/AuthContext';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } } }));
let onAuth: (event: string, session: object | null) => void;
const unsubscribe = jest.fn();
const member = { user: { id: 'local-member' }, expires_at: 9999999999 };
function Consumer() {
  const { isAuthenticated, isLoading } = useAuth();
  return <div data-testid="auth-state" data-authenticated={String(isAuthenticated)}>{isLoading ? 'Loading' : isAuthenticated ? 'Signed in' : 'Signed out'}</div>;
}
beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear();
  (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation(callback => {
    onAuth = callback; return { data: { subscription: { unsubscribe } } };
  });
});

it('starts with the same loading state despite a browser-only cached session, then uses Supabase', async () => {
  let finish!: (value: unknown) => void;
  sessionStorage.setItem('supabase_session', JSON.stringify(member));
  (supabase.auth.getSession as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { unmount } = render(<AuthContextProvider><Consumer /></AuthContextProvider>);
  expect(screen.getByText('Loading')).toBeInTheDocument();
  expect(screen.getByTestId('auth-state')).toHaveAttribute('data-authenticated', 'false');
  expect(sessionStorage.getItem('supabase_session')).toBeNull();
  await act(async () => { finish({ data: { session: member }, error: null }); });
  expect(screen.getByText('Signed in')).toBeInTheDocument();
  unmount(); expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it('does not restore an old session after a newer sign-out event', async () => {
  let finish!: (value: unknown) => void;
  (supabase.auth.getSession as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(<AuthContextProvider><Consumer /></AuthContextProvider>);
  act(() => onAuth('SIGNED_OUT', null));
  await act(async () => { finish({ data: { session: member }, error: null }); });
  expect(screen.getByText('Signed out')).toBeInTheDocument();
});

it('settles on signed out when session lookup fails', async () => {
  (supabase.auth.getSession as jest.Mock).mockRejectedValue(new Error('Offline'));
  await act(async () => { render(<AuthContextProvider><Consumer /></AuthContextProvider>); });
  expect(screen.getByText('Signed out')).toBeInTheDocument();
});
