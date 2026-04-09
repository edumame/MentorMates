"use client";

import { useMemo, useState } from "react";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type {
  IntakeFormAnswers,
  IntakeFormField,
  IntakeFormSchema,
} from "@/features/intake-forms/types";

// Trigger mode: dialog manages its own open state via DialogTrigger.
// Controlled mode: caller controls open/close (for programmatic flows).
type ParticipantIntakeDialogProps = {
  schema: IntakeFormSchema;
  submitting?: boolean;
  onSubmit: (answers: IntakeFormAnswers) => Promise<void>;
} & (
  | { trigger: React.ReactNode; open?: never; onClose?: never }
  | { trigger?: never; open: boolean; onClose: () => void }
);

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

// Split text on URLs and render each URL as a clickable hyperlink.
// Uses a capture group in split() so matched URLs appear as odd-indexed elements.
function renderWithLinks(text: string) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#4B89EF] underline underline-offset-2 hover:text-[#3E7EEA] break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}

function validateRequired(field: IntakeFormField, value: unknown): boolean {
  if (!field.required) return true;

  if (field.type === "checkbox") {
    return value === true;
  }

  if (field.type === "multi_select") {
    return Array.isArray(value) && value.length > 0;
  }

  return typeof value === "string"
    ? value.trim().length > 0
    : value !== null && value !== undefined;
}

export function ParticipantIntakeDialog(props: ParticipantIntakeDialogProps) {
  const { schema, submitting = false, onSubmit } = props;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = props.trigger !== undefined ? internalOpen : props.open;
  const handleClose = () => {
    if (props.trigger !== undefined) {
      setInternalOpen(false);
    } else {
      // props.onClose is guaranteed by the discriminated union when trigger is absent
      (props as { onClose: () => void }).onClose();
    }
  };

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
      setError(
        `Please complete required fields: ${missingRequiredLabels.join(", ")}`
      );
      return;
    }

    await onSubmit(answers);
  };

  const handleAnswerChange = (key: string, value: unknown) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      {props.trigger ? (
        <DialogTrigger asChild>{props.trigger}</DialogTrigger>
      ) : null}
      <DialogContent className="flex flex-col gap-0 p-0 w-[calc(100%-2rem)] max-h-[90dvh] sm:max-w-2xl overflow-hidden rounded-xl">
        {/* Blue accent bar — matches the builder card style */}
        <div className="h-1.5 w-full flex-shrink-0 rounded-t-xl bg-[#4B89EF]" />

        {/* Sticky header */}
        <DialogHeader className="flex-shrink-0 px-5 pb-3 pt-5 sm:px-6">
          <DialogTitle className="text-xl font-semibold leading-tight">
            {schema.title}
          </DialogTitle>
          {schema.description ? (
            <DialogDescription className="mt-1 text-sm leading-relaxed text-black/60">
              {schema.description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {/* Scrollable field body */}
        <div className="flex-1 overflow-y-auto px-5 pb-2 sm:px-6">
          <div className="space-y-5 py-2">
            {visibleFields.map((field) => {
              const value = answers[field.key];
              const options = field.options ?? [];

              return (
                <div key={field.id} className="space-y-1.5">
                  {field.type !== "checkbox" && (
                    <label className="text-sm font-medium text-black/90">
                      {field.label}
                      {field.required ? (
                        <span className="ml-0.5 text-[#4B89EF]"> *</span>
                      ) : null}
                    </label>
                  )}

                  {field.description ? (
                    <p className="text-xs text-black/55">{field.description}</p>
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
                      className="h-10"
                    />
                  )}

                  {field.type === "long_text" && (
                    <Textarea
                      value={typeof value === "string" ? value : ""}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        handleAnswerChange(field.key, event.target.value)
                      }
                      className="min-h-[80px]"
                    />
                  )}

                  {field.type === "single_select" && (
                    <Select
                      value={typeof value === "string" ? value : ""}
                      onValueChange={(val) => handleAnswerChange(field.key, val)}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {field.type === "multi_select" && (
                    <div className="space-y-2 rounded-md border border-black/10 p-3">
                      {options.map((option) => {
                        const current = Array.isArray(value)
                          ? (value as string[])
                          : [];
                        const checked = current.includes(option);

                        return (
                          <label
                            key={option}
                            className="flex cursor-pointer items-start gap-2.5 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(checkedValue) => {
                                const next = checkedValue
                                  ? [...current, option]
                                  : current.filter((item) => item !== option);
                                handleAnswerChange(field.key, next);
                              }}
                              className="mt-0.5 flex-shrink-0"
                            />
                            <span className="leading-snug">{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {field.type === "checkbox" && (
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-black/10 bg-black/[0.02] p-3 text-sm transition-colors hover:bg-black/[0.04]">
                      <Checkbox
                        checked={Boolean(value)}
                        onCheckedChange={(checkedValue) =>
                          handleAnswerChange(field.key, Boolean(checkedValue))
                        }
                        className="mt-0.5 flex-shrink-0"
                      />
                      <span className="leading-snug text-black/80">
                        {renderWithLinks(field.label)}
                        {field.required ? (
                          <span className="ml-0.5 text-[#4B89EF]"> *</span>
                        ) : null}
                      </span>
                    </label>
                  )}
                </div>
              );
            })}

            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-black/10 px-5 py-4 sm:px-6">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#4B89EF] text-white hover:bg-[#3E7EEA]"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
