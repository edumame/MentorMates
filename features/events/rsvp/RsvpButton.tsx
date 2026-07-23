"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RsvpDialog } from "./RsvpDialog";

type RsvpStatus = {
  hasActiveForm: boolean;
  completed: boolean;
};

type RsvpButtonProps = {
  eventId: string;
  className?: string;
};

/**
 * Shows an RSVP call-to-action for users who have already joined an event.
 * Renders nothing unless the event has a published RSVP form.
 */
export function RsvpButton({ eventId, className }: RsvpButtonProps) {
  const [status, setStatus] = useState<RsvpStatus | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/rsvp/status`, {
        cache: "no-store",
      });

      if (!response.ok) {
        setStatus(null);
        return;
      }

      const data = (await response.json()) as RsvpStatus;
      setStatus(data);
    } catch {
      // Keep the button hidden if the status check fails; RSVP is optional.
      setStatus(null);
    }
  }, [eventId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  if (!status?.hasActiveForm) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant={status.completed ? "outline" : "default"}
        className={className ?? "rounded-full gap-2 w-full"}
        onClick={() => setIsDialogOpen(true)}
      >
        <CalendarCheck className="h-5 w-5 flex-shrink-0" />
        <span className="truncate">
          {status.completed ? "Update RSVP" : "RSVP to Event"}
        </span>
      </Button>
      <RsvpDialog
        open={isDialogOpen}
        eventId={eventId}
        onClose={() => setIsDialogOpen(false)}
        onCompleted={() => {
          setStatus((current) =>
            current ? { ...current, completed: true } : current
          );
          loadStatus();
        }}
      />
    </>
  );
}
