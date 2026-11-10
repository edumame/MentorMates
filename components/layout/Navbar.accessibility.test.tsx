import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Navbar } from './Navbar';
import { AuthNavbar } from './AuthNavbar';
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/about' }));
jest.mock('@/features/user/authentication/redirect/RedirectProvider', () => ({ useRedirect: () => ({ clearReturnUrl: jest.fn(), setReturnUrl: jest.fn() }) }));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: {
  getSession: async () => ({ data: { session: null }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
} } }));
jest.mock('./AuthNavbarRight', () => ({ AuthNavbarRight: () => null }));
jest.mock('posthog-js', () => ({ reset: jest.fn() }));
test.each([['public', Navbar], ['authenticated', AuthNavbar]] as const)('%s mobile toggle exposes current expanded state and controlled region', async (_name, Component) => {
  render(<Component />);
  const toggle = screen.getByRole('button', { name: 'Toggle menu' });
  await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'false'));
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById(toggle.getAttribute('aria-controls')!)).not.toBeNull();
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
