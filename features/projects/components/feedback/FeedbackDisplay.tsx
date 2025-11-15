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

  const feedbackContent = (
    <>
      {feedback.length > 0 ? (
        <div className="space-y-4 sm:space-y-6">
          {feedback.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 sm:gap-4 bg-white sm:bg-gray-50 p-4 sm:p-5 rounded-lg border border-gray-200 shadow-sm sm:shadow-none"
            >
              <div className="flex-shrink-0">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm sm:text-base">
                  {getInitials(item.mentor_name)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-1 sm:gap-2 mb-2">
                  <span className="font-semibold text-gray-900 text-sm sm:text-base break-words">
                    {item.mentor_name || "Anonymous"}
                  </span>
                  {item.mentor_email && (
                    <>
                      <span className="hidden sm:inline text-sm text-gray-500">•</span>
                      <span className="text-xs sm:text-sm text-gray-500 break-all">
                        {item.mentor_email}
                      </span>
                    </>
                  )}
                  <span className="hidden sm:inline text-sm text-gray-500">•</span>
                  <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                  {item.feedback_text}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <MessageSquare className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No feedback yet
          </h3>
          <p className="text-gray-600 mb-4">
            This project hasn&apos;t received any feedback yet.
          </p>
          <p className="text-sm text-gray-500">
            Share your project&apos;s QR code or link to start receiving valuable feedback from mentors and peers.
          </p>
        </div>
      )}
    </>
  );

  if (showTitle) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Project Feedback
            {feedback.length > 0 && (
              <span className="text-sm font-normal text-gray-500">
                ({feedback.length} {feedback.length === 1 ? 'review' : 'reviews'})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-visible">
          {feedbackContent}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`${className} overflow-visible`}>
      {feedbackContent}
    </div>
  );
} 