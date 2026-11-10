import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs } from '@/components/ui/tabs';
import { ProjectDetailTabs } from './ProjectDetailTabs';
import { ProjectLoadError } from './ProjectLoadError';
import fs from 'node:fs';
import path from 'node:path';

test.each([false, true])('common section order stays stable with tracks=%s', hasTracks => {
  render(<Tabs defaultValue="overview"><ProjectDetailTabs hasTracks={hasTracks} totalMembers={3} feedbackCount={7} /></Tabs>);
  expect(screen.getAllByRole('tab').map(x => x.textContent)).toEqual([
    'Overview', ...(hasTracks ? ['Tracks'] : []), 'Team3', 'Feedback7', 'Sharing',
  ]);
});
test('judge tool is explicitly gated while common section order is unchanged', () => {
  render(<Tabs defaultValue="overview"><ProjectDetailTabs hasTracks totalMembers={3} feedbackCount={7} isJudge /></Tabs>);
  expect(screen.getAllByRole('tab').map(x => x.textContent)).toEqual(['Overview','Tracks','Team3','Feedback7','Judge Scoring','Sharing']);
});
test.each(['app/projects/[id]/page.tsx','app/projects/public/[id]/page.tsx'])('%s uses shared navigation and retry/loading contracts', route => {
  const source = fs.readFileSync(path.join(process.cwd(), route), 'utf8');
  expect(source).toMatch(/<ProjectDetailTabs hasTracks=\{hasEventTracks\} totalMembers=\{totalMembers\} feedbackCount=\{feedbackCount\}/);
  expect(source).toContain('useProjectDetailLoader(projectId,');
  expect(source).toContain('<ProjectLoadError message={loadError} retry={retryProject}');
  expect(source).toContain('xl:w-[480px] lg:flex-shrink-0');
  expect(source).toContain('<ProjectFeedbackSection projectId={project.id} onGiveFeedback=');
});
test('error is announced and retry is keyboard-accessible native button', () => {
  const retry = jest.fn(); render(<ProjectLoadError message="Unable to load" retry={retry} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to load');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' })); expect(retry).toHaveBeenCalledTimes(1);
});
