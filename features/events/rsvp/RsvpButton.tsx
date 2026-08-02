"use client";

import { CalendarCheck } from "lucide-react";

import { IntakeCtaButton } from "@/features/intake-forms/components/IntakeCtaButton";

type RsvpButtonProps = {
  eventId: string;
  className?: string;
};

/**
 * Shows an RSVP call-to-action for users who have already joined an event.
 * Renders nothing unless the event has a published RSVP form.
 */
export function RsvpButton({ eventId, className }: RsvpButtonProps) {
  return (
    <IntakeCtaButton
      eventId={eventId}
      context="rsvp"
      icon={<CalendarCheck className="h-5 w-5 flex-shrink-0" />}
      openLabel="RSVP to Event"
      completedLabel="Update RSVP"
      className={className}
    />
  );
}
