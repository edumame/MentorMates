"use client";

import { useFeedbackData } from "@/features/projects/components/management/project-dashboard/hooks/useFeedbackData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { getInitials } from "@/lib/utils/string";

interface FeedbackDisplayProps {
  projectId: string;
  showTitle?: boolean;
  className?: string;
}

export default function FeedbackDisplay({ 
  projectId, 
  showTitle = true,
  className = ""
}: FeedbackDisplayProps) {
  const { feedback, isLoadingFeedback } = useFeedbackData(projectId);

  if (isLoadingFeedback) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Project Feedback
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading feedback...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {showTitle && (
        <div>
          <h2 className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Project Feedback
            {feedback.length > 0 && (
              <span className="text-sm font-normal text-gray-500">
                ({feedback.length} {feedback.length === 1 ? 'review' : 'reviews'})
              </span>
            )}
          </h2>
        </div>
      )}
      <div>
        {feedback.length > 0 ? (
          <div className="flex flex-col gap-4">
            {feedback.map((item) => (
              <FeedbackCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border border-dashed border-gray-200 rounded-[20px]">
            <div className="mx-auto flex items-center justify-center mb-4 relative">
              <Gesture className="text-gray-400" style={{ fontSize: 40 }} />
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none" className="absolute">
                <path d="M33.833 3.36816C34.6402 3.36816 35.2532 3.62597 35.793 4.16504C36.3312 4.7028 36.5898 5.31482 36.5898 6.12402C36.5898 6.93339 36.3319 7.54424 35.7959 8.0791C35.2585 8.61519 34.6446 8.87402 33.833 8.87402C33.0227 8.87395 32.4116 8.61522 31.877 8.08008C31.3414 7.54358 31.084 6.93203 31.084 6.12402C31.0841 5.31618 31.3411 4.70248 31.8789 4.16309L31.8799 4.16406C32.4169 3.62592 33.027 3.36823 33.833 3.36816Z" fill="black" stroke="#71717A" strokeWidth="4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No feedback yet
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Share your project&apos;s QR code or link to start receiving valuable feedback from mentors and peers.
            </p>
            <div>
              <Button variant="default" onClick={() => setShowShareFeedbackDialog(true)}>
                Share project
              </Button>
            </div>
          </div>
        )}
      </div>
      <ShareFeedbackDialog
        open={showShareFeedbackDialog}
        onOpenChange={setShowShareFeedbackDialog}
        projectId={projectId}

      />
    </div>
  );
} 