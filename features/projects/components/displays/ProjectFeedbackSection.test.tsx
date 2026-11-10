import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectFeedbackSection } from './ProjectFeedbackSection';
jest.mock('@/features/projects/components/feedback/FeedbackDisplay', () => ({ __esModule: true, default: ({ projectId }: { projectId: string }) => <div>Feedback for {projectId}</div> }));
test('shared feedback copy, hierarchy and action render on both routes', () => {
  const onGiveFeedback=jest.fn(); render(<ProjectFeedbackSection projectId="fixture" onGiveFeedback={onGiveFeedback} />);
  expect(screen.getByText('Project Feedback')).toBeInTheDocument();
  expect(screen.getByText('Share Your Feedback')).toBeInTheDocument();
  expect(screen.getByText('Feedback for fixture')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Give Feedback'})); expect(onGiveFeedback).toHaveBeenCalledTimes(1);
});
