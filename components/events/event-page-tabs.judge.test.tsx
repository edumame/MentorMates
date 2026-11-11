import { render, screen } from '@testing-library/react';
import { EventPageTabs } from './event-page-tabs';
import { EventRole } from '@/lib/types';
jest.mock('next/navigation', () => ({ usePathname: () => '/events/event/overview', useSearchParams: () => new URLSearchParams('view=judge') }));
jest.mock('./ActiveRoleContext', () => ({ useActiveRole: () => ({ activeRole: EventRole.Judge }) }));
it('gives judges a Projects link to the event gallery', () => {
 render(<EventPageTabs eventId="event" projectCount={3} />);
 expect(screen.getByRole('link', { name: /Projects/ })).toHaveAttribute('href', '/events/event/gallery?view=judge');
 expect(screen.queryByRole('link', { name: /Schedule/ })).toBeNull();
});
