"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { IntakeFormAnswers, IntakeFormField, IntakeFormSchema } from "@/features/intake-forms/types";

type ParticipantIntakeDialogProps = {
  open: boolean;
  schema: IntakeFormSchema;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (answers: IntakeFormAnswers) => Promise<void>;
};

function initializeAnswers(schema: IntakeFormSchema): IntakeFormAnswers {
  const initial: IntakeFormAnswers = {};

  for (const field of schema.fields) {
    if (field.type === "multi_select") {
      initial[field.key] = [];
      continue;
    }

    if (field.type === "checkbox") {
      initial[field.key] = false;
      continue;
    }

    initial[field.key] = "";
  }

  return initial;
}

function validateRequired(field: IntakeFormField, value: unknown): boolean {
  if (!field.required) return true;

  if (field.type === "checkbox") {
    return value === true;
  }

  if (field.type === "multi_select") {
    return Array.isArray(value) && value.length > 0;
  }

  return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
}

export function ParticipantIntakeDialog({
  open,
  schema,
  submitting = false,
  onClose,
  onSubmit,
}: ParticipantIntakeDialogProps) {
  const [answers, setAnswers] = useState<IntakeFormAnswers>(() =>
    initializeAnswers(schema)
  );
  const [error, setError] = useState<string | null>(null);

  const visibleFields = useMemo(() => {
    return schema.fields.filter((field) => {
      if (!field.showIf) return true;
      const currentValue = answers[field.showIf.fieldKey];
      return String(currentValue ?? "") === field.showIf.equals;
    });
  }, [answers, schema.fields]);

  const missingRequiredLabels = visibleFields
    .filter((field) => !validateRequired(field, answers[field.key]))
    .map((field) => field.label);

  const handleSubmit = async () => {
    setError(null);

    if (missingRequiredLabels.length > 0) {
      setError(`Please complete required fields: ${missingRequiredLabels.join(", ")}`);
      return;
    }

    await onSubmit(answers);
  };

  const handleAnswerChange = (key: string, value: unknown) => {
    setAnswers((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
        <DialogHeader>
          <DialogTitle>{schema.title}</DialogTitle>
          {schema.description ? (
            <DialogDescription>{schema.description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-4">
          {visibleFields.map((field) => {
            const value = answers[field.key];
            const options = field.options ?? [];

            return (
              <div key={field.id} className="space-y-2">
                <label className="text-sm font-medium text-black">
                  {field.label}
                  {field.required ? " *" : ""}
                </label>

                {field.description ? (
                  <p className="text-xs text-black/60">{field.description}</p>
                ) : null}

                {(field.type === "short_text" ||
                  field.type === "email" ||
                  field.type === "number" ||
                  field.type === "date") && (
                  <Input
                    type={
                      field.type === "short_text"
                        ? "text"
                        : field.type === "email"
                          ? "email"
                          : field.type
                    }
                    value={typeof value === "string" ? value : ""}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      handleAnswerChange(field.key, event.target.value)
                    }
                  />
                )}

                {field.type === "long_text" && (
                  <Textarea
                    value={typeof value === "string" ? value : ""}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      handleAnswerChange(field.key, event.target.value)
                    }
                  />
                )}

                {field.type === "single_select" && (
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) =>
                      handleAnswerChange(field.key, event.target.value)
                    }
                  >
                    <option value="">Select an option</option>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === "multi_select" && (
                  <div className="space-y-2 rounded-md border border-black/10 p-3">
                    {options.map((option) => {
                      const current = Array.isArray(value)
                        ? (value as string[])
                        : [];
                      const checked = current.includes(option);

                      return (
                        <label key={option} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(checkedValue) => {
                              const next = checkedValue
                                ? [...current, option]
                                : current.filter((item) => item !== option);
                              handleAnswerChange(field.key, next);
                            }}
                          />
                          {option}
                        </label>
                      );
                    })}
                  </div>
                )}

                {field.type === "checkbox" && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={Boolean(value)}
                      onCheckedChange={(checkedValue) =>
                        handleAnswerChange(field.key, Boolean(checkedValue))
                      }
                    />
                    {field.placeholder || "Yes"}
                  </label>
                )}
              </div>
            );
          })}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
