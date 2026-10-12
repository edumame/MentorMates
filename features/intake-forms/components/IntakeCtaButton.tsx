"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { IntakeFormDialog } from "@/features/intake-forms/components/IntakeFormDialog";
import type { PerUserIntakeFormContext } from "@/features/intake-forms/types";

type IntakeFormStatus = {
  hasActiveForm: boolean;
  completed: boolean;
};

type IntakeCtaButtonProps = {
  eventId: string;
  context: PerUserIntakeFormContext;
  icon: ReactNode;
  openLabel: string;
  completedLabel: string;
  className?: string;
};

/**
 * Call-to-action button for a per-user intake form (RSVP, post-survey).
 * Renders nothing unless the event has a published form for the context.
 */
export function IntakeCtaButton({
  eventId,
  context,
  icon,
  openLabel,
  completedLabel,
  className,
}: IntakeCtaButtonProps) {
  const [status, setStatus] = useState<IntakeFormStatus | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/events/${eventId}/intake-form/status?context=${context}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        setStatus(null);
        return;
      }

      const data = (await response.json()) as IntakeFormStatus;
      setStatus(data);
    } catch {
      // Keep the button hidden if the status check fails; these forms are
      // optional.
      setStatus(null);
    }
  }, [eventId, context]);

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
        {icon}
        <span className="truncate">
          {status.completed ? completedLabel : openLabel}
        </span>
      </Button>
      <IntakeFormDialog
        open={isDialogOpen}
        eventId={eventId}
        context={context}
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
