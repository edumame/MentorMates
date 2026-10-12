"use client";

import { ClipboardList } from "lucide-react";

import { IntakeCtaButton } from "@/features/intake-forms/components/IntakeCtaButton";

type PostSurveyButtonProps = {
  eventId: string;
  className?: string;
};

/**
 * Shows a post-event survey call-to-action for users who have already joined
 * an event. Renders nothing unless the event has a published post-survey form.
 */
export function PostSurveyButton({ eventId, className }: PostSurveyButtonProps) {
  return (
    <IntakeCtaButton
      eventId={eventId}
      context="post_survey"
      icon={<ClipboardList className="h-5 w-5 flex-shrink-0" />}
      openLabel="Take Post-Event Survey"
      completedLabel="Update Survey Response"
      className={className}
    />
  );
}
