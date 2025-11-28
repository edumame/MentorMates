"use client";

import { useFeedbackData } from "@/features/projects/components/management/project-dashboard/hooks/useFeedbackData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { getInitials } from "@/lib/utils/string";
import { Gesture } from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { FeedbackItem } from "@/lib/types";
import { ShareFeedbackDialog } from "./ShareFeedbackDialog";
import { useState } from "react";

interface FeedbackDisplayProps {
  projectId: string;
  showTitle?: boolean;
  className?: string;
}

/**
 * Distributes an array in a round-robin manner to a specified number of columns
 * Example: [1,2,3,4,5,6,7] -> [[1,4,7], [2,5], [3,6]]
 * @param items The array to distribute
 * @param columns The number of columns
 * @returns A 2D array, where each sub-array represents a column
 */
function distributeToColumns<T>(items: T[], columns: number): T[][] {
  const result: T[][] = Array.from({ length: columns }, () => []);

  items.forEach((item, index) => {
    const columnIndex = index % columns;
    result[columnIndex].push(item);
  });

  return result;
}

function FeedbackCard({ item }: { item: FeedbackItem }) {
  return (
    <div
      key={item.id}
      className="flex flex-col items-start space-x-4 bg-gray-50 p-4 rounded-lg border"
    >
      <div className="flex-shrink-0 mb-3">
        <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
          {getInitials(item.mentor_name)}
        </div>
      </div>
      <div className="flex-1 min-w-0 !m-0">
        <div className="flex items-center space-x-2 mb-2">
          <span className="font-semibold text-gray-900">
            {item.mentor_name || "Anonymous"}
          </span>
          {/* {item.mentor_email && (
            <span className="text-sm text-gray-500">
              ({item.mentor_email})
            </span>
          )} */}
          <span className="text-sm text-gray-500">
            •
          </span>
          <span className="text-sm text-gray-500">
            {new Date(item.created_at).toLocaleDateString()}
          </span>
        </div>
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
          {item.feedback_text}
        </p>
      </div>
    </div>
  );
}

export default function FeedbackDisplay({
  projectId,
  showTitle = true,
  className = ""
}: FeedbackDisplayProps) {
  const { feedback, isLoadingFeedback } = useFeedbackData(projectId);
  const feedbackColumns = distributeToColumns(feedback, 3);
  const [showShareFeedbackDialog, setShowShareFeedbackDialog] = useState(false);

  if (isLoadingFeedback) {
    return (
      <div className={className}>
        {showTitle && (
          <div>
            <h2 className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Project Feedback
            </h2>
          </div>
        )}
        <div>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading feedback...</p>
            </div>
          </div>
        </div>
      </div>
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
          <>
            <div className="gap-4 hidden sm:flex">
              {feedbackColumns.map((column, index) => (
                <div key={`column-${index}`} className="flex flex-col gap-4">
                  {column.map((item) => (
                    <FeedbackCard key={item.id} item={item} />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-4 sm:hidden">
              {feedback.map((item) => (
                <FeedbackCard key={item.id} item={item} />
              ))}
            </div>
          </>
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
