import { render, screen } from '@testing-library/react';
import { Modules } from './Modules';
import { mentorMatesModules, MODULE_STATUS_LABEL } from '@/lib/modules';
it('renders every registered module and its actual availability', () => {
 render(<Modules />);
 for(const item of mentorMatesModules) {
  expect(screen.getByRole('heading', { name: item.name })).toBeInTheDocument();
  expect(screen.getAllByText(MODULE_STATUS_LABEL[item.status]).length).toBeGreaterThan(0);
  if(item.url) {
   const link=screen.getByRole('link', { name: (name: string) => name.includes(item.name) });
   expect(link).toHaveAttribute('href', item.url);
   if(item.url.startsWith('http')) expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
 }
});
