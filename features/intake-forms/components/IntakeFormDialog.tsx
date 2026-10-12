"use client";

import { useEffect, useState } from "react";

import { ParticipantIntakeDialog } from "@/features/intake-forms/components/ParticipantIntakeDialog";
import type {
  IntakeFormAnswers,
  IntakeFormSchema,
  PerUserIntakeFormContext,
} from "@/features/intake-forms/types";
import { toast } from "@/lib/hooks/use-toast";

type ActiveIntakeForm = {
  formVersionId: string;
  schema: IntakeFormSchema;
};

type IntakeFormDialogCopy = {
  loadErrorTitle: string;
  loadErrorFallback: string;
  missingFormError: string;
  successTitle: string;
  successDescription: string;
  submitErrorTitle: string;
  submitErrorFallback: string;
};

const DIALOG_COPY: Record<PerUserIntakeFormContext, IntakeFormDialogCopy> = {
  registration: {
    loadErrorTitle: "Cannot open questionnaire",
    loadErrorFallback: "Failed to load questionnaire",
    missingFormError: "No published registration questionnaire found",
    successTitle: "Questionnaire completed",
    successDescription: "Thanks. Continue joining the event.",
    submitErrorTitle: "Could not submit questionnaire",
    submitErrorFallback: "Failed to submit questionnaire",
  },
  rsvp: {
    loadErrorTitle: "Cannot open RSVP form",
    loadErrorFallback: "Failed to load RSVP form",
    missingFormError: "No published RSVP form found",
    successTitle: "RSVP submitted",
    successDescription: "Thanks for confirming. See you at the event!",
    submitErrorTitle: "Could not submit RSVP",
    submitErrorFallback: "Failed to submit RSVP",
  },
  post_survey: {
    loadErrorTitle: "Cannot open survey",
    loadErrorFallback: "Failed to load survey",
    missingFormError: "No published post-event survey found",
    successTitle: "Survey submitted",
    successDescription: "Thanks for sharing your feedback!",
    submitErrorTitle: "Could not submit survey",
    submitErrorFallback: "Failed to submit survey",
  },
};

type IntakeFormDialogProps = {
  open: boolean;
  eventId: string;
  context: PerUserIntakeFormContext;
  onClose: () => void;
  onCompleted: () => void;
};

/**
 * Loads the active published intake form for a per-user context
 * (registration, RSVP, post-survey) and renders it as a dialog.
 */
export function IntakeFormDialog({
  open,
  eventId,
  context,
  onClose,
  onCompleted,
}: IntakeFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeForm, setActiveForm] = useState<ActiveIntakeForm | null>(null);
  const copy = DIALOG_COPY[context];

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      try {
        const response = await fetch(
          `/api/events/${eventId}/intake-form?context=${context}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || copy.loadErrorFallback);
        }

        const data = (await response.json()) as {
          form: ActiveIntakeForm | null;
        };

        if (!data.form?.formVersionId || !data.form.schema) {
          throw new Error(copy.missingFormError);
        }

        setActiveForm(data.form);
      } catch (error) {
        toast({
          title: copy.loadErrorTitle,
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
        onClose();
      }
    };

    load();
  }, [open, eventId, context, copy, onClose]);

  const handleSubmit = async (answers: IntakeFormAnswers) => {
    if (!activeForm) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(
        `/api/events/${eventId}/intake-form/submissions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context,
            formVersionId: activeForm.formVersionId,
            answers,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || copy.submitErrorFallback);
      }

      toast({
        title: copy.successTitle,
        description: copy.successDescription,
      });
      onCompleted();
      onClose();
    } catch (error) {
      toast({
        title: copy.submitErrorTitle,
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keep ParticipantIntakeDialog mounted while activeForm exists so background
  // refetches don't reset in-progress answers.
  if (!open || !activeForm) {
    return null;
  }

  return (
    <ParticipantIntakeDialog
      open={open}
      schema={activeForm.schema}
      submitting={isSubmitting}
      onClose={onClose}
      onSubmit={handleSubmit}
    />
  );
}
