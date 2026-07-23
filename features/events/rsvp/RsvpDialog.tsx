"use client";

import { useEffect, useState } from "react";

import { ParticipantIntakeDialog } from "@/features/intake-forms/components/ParticipantIntakeDialog";
import type {
  IntakeFormAnswers,
  IntakeFormSchema,
} from "@/features/intake-forms/types";
import { toast } from "@/lib/hooks/use-toast";

type ActiveIntakeForm = {
  formVersionId: string;
  schema: IntakeFormSchema;
};

type RsvpDialogProps = {
  open: boolean;
  eventId: string;
  onClose: () => void;
  onCompleted: () => void;
};

export function RsvpDialog({
  open,
  eventId,
  onClose,
  onCompleted,
}: RsvpDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeForm, setActiveForm] = useState<ActiveIntakeForm | null>(null);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      try {
        const response = await fetch(
          `/api/events/${eventId}/intake-form?context=rsvp`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load RSVP form");
        }

        const data = (await response.json()) as {
          form: ActiveIntakeForm | null;
        };

        if (!data.form?.formVersionId || !data.form.schema) {
          throw new Error("No published RSVP form found");
        }

        setActiveForm(data.form);
      } catch (error) {
        toast({
          title: "Cannot open RSVP form",
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
        onClose();
      }
    };

    load();
  }, [open, eventId, onClose]);

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
            context: "rsvp",
            formVersionId: activeForm.formVersionId,
            answers,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit RSVP");
      }

      toast({
        title: "RSVP submitted",
        description: "Thanks for confirming. See you at the event!",
      });
      onCompleted();
      onClose();
    } catch (error) {
      toast({
        title: "Could not submit RSVP",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keep ParticipantIntakeDialog mounted while activeForm exists so background
  // refetches don't reset in-progress answers (same pattern as the
  // registration questionnaire dialog).
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
