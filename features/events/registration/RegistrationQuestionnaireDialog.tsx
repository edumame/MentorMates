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

type RegistrationQuestionnaireDialogProps = {
  open: boolean;
  eventId: string;
  onClose: () => void;
  onCompleted: () => void;
};

export function RegistrationQuestionnaireDialog({
  open,
  eventId,
  onClose,
  onCompleted,
}: RegistrationQuestionnaireDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeForm, setActiveForm] = useState<ActiveIntakeForm | null>(null);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      try {
        const response = await fetch(
          `/api/events/${eventId}/intake-form?context=registration`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load questionnaire");
        }

        const data = (await response.json()) as {
          form: ActiveIntakeForm | null;
        };

        if (!data.form?.formVersionId || !data.form.schema) {
          throw new Error("No published registration questionnaire found");
        }

        setActiveForm(data.form);
      } catch (error) {
        toast({
          title: "Cannot open questionnaire",
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
        onClose();
      } finally {}
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
            context: "registration",
            formVersionId: activeForm.formVersionId,
            answers,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit questionnaire");
      }

      toast({
        title: "Questionnaire completed",
        description: "Thanks. Continue joining the event.",
      });
      onCompleted();
      onClose();
    } catch (error) {
      toast({
        title: "Could not submit questionnaire",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't include isLoading here — removing it from the condition keeps
  // ParticipantIntakeDialog mounted during background refetches (e.g. on
  // window focus), preventing its form state from being reset.
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
