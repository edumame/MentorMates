import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FeedbackDisplay from '@/features/projects/components/feedback/FeedbackDisplay';

/** Shared non-sensitive feedback presentation on public and authenticated details. */
export function ProjectFeedbackSection({ projectId, onGiveFeedback }: { projectId: string; onGiveFeedback: () => void }) {
  return <div className="space-y-8">
    <Card><CardHeader>
      <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />Project Feedback</CardTitle>
      <p className="text-sm text-gray-600">See what mentors and peers have said about this project.</p>
    </CardHeader><CardContent><FeedbackDisplay projectId={projectId} showTitle={false} /></CardContent></Card>
    <Card><CardHeader>
      <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />Share Your Feedback</CardTitle>
      <p className="text-sm text-gray-600">Help this project improve by sharing your thoughts, suggestions, and ideas.</p>
    </CardHeader><CardContent>
      <Button onClick={onGiveFeedback} className="w-full bg-[#4B89EF] hover:bg-[#3F77D3] text-white"><MessageSquare className="mr-2 h-4 w-4" />Give Feedback</Button>
    </CardContent></Card>
  </div>;
}
