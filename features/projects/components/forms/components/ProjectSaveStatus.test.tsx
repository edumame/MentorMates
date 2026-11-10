import { fireEvent, render, screen } from '@testing-library/react';
import { ProjectSaveStatus } from './ProjectSaveStatus';

const props = { isSaving: false, saveError: null, hasUnsavedChanges: true, lastSaved: null, onRetry: jest.fn().mockResolvedValue(true) };

it('keeps failure visible and exposes retry instead of stale saved timestamp', () => {
  render(<ProjectSaveStatus {...props} saveError="Offline" lastSaved={new Date()} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Draft not saved: Offline');
  expect(screen.queryByText(/Saved at/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));
  expect(props.onRetry).toHaveBeenCalledTimes(1);
});

it('disables retry during a save and never calls dirty changes saved', () => {
  const { rerender } = render(<ProjectSaveStatus {...props} isSaving saveError="Offline" />);
  expect(screen.getByRole('button', { name: 'Retry save' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('Saving draft');
  rerender(<ProjectSaveStatus {...props} lastSaved={new Date()} />);
  expect(screen.getByRole('status')).toHaveTextContent('Changes are not saved yet');
  expect(screen.queryByText(/Saved at/)).not.toBeInTheDocument();
});

it('shows expired-session state instead of success and removes retry', () => {
  render(<ProjectSaveStatus {...props} hasUnsavedChanges={false} lastSaved={new Date()} isSessionActive={false} saveError="Unauthorized" />);
  expect(screen.getByRole('alert')).toHaveTextContent('Sign in again');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByText(/Saved at/)).not.toBeInTheDocument();
});
