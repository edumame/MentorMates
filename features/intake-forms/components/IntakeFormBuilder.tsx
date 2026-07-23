"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  Copy,
  GripVertical,
  Plus,
  Trash2,
  X,
  FileText,
  ListChecks,
  ShieldCheck,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils";
import type {
  IntakeFieldType,
  IntakeFormContext,
  IntakeFormField,
  IntakeFormSchema,
} from "@/features/intake-forms/types";
import { createMLHComplianceTemplate } from "@/features/intake-forms/templates/mlhCompliance";

type IntakeFormBuilderProps = {
  eventId: string;
  context?: IntakeFormContext;
  className?: string;
};

type LastPublishedState = {
  versionId: string;
  versionNumber: number;
  publishedAt: string;
  schema: IntakeFormSchema;
} | null;

type FieldTypeOption = {
  type: IntakeFieldType;
  label: string;
  defaultLabel: string;
  defaultPlaceholder?: string;
  hasOptions?: boolean;
};

const FIELD_TYPES: FieldTypeOption[] = [
  {
    type: "short_text",
    label: "Short answer",
    defaultLabel: "Untitled question",
    defaultPlaceholder: "Short answer text",
  },
  {
    type: "long_text",
    label: "Paragraph",
    defaultLabel: "Untitled question",
    defaultPlaceholder: "Long answer text",
  },
  {
    type: "single_select",
    label: "Multiple choice",
    defaultLabel: "Untitled question",
    hasOptions: true,
  },
  {
    type: "multi_select",
    label: "Checkboxes",
    defaultLabel: "Untitled question",
    hasOptions: true,
  },
  {
    type: "checkbox",
    label: "Consent checkbox",
    defaultLabel: "I agree",
  },
  {
    type: "email",
    label: "Email",
    defaultLabel: "Email",
    defaultPlaceholder: "name@example.com",
  },
  {
    type: "number",
    label: "Number",
    defaultLabel: "Untitled number question",
    defaultPlaceholder: "0",
  },
  {
    type: "date",
    label: "Date",
    defaultLabel: "Untitled date question",
  },
];

const DEFAULT_SCHEMA: IntakeFormSchema = {
  title: "Untitled form",
  description: "Form description",
  fields: [],
};

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `fld_${Math.random().toString(36).slice(2, 10)}`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function buildFieldKey(label: string, id: string) {
  const base = slugify(label) || "question";
  return `${base}_${id.slice(0, 6)}`;
}

function arrayMove<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function getFieldTypeOption(type: IntakeFieldType) {
  return FIELD_TYPES.find((option) => option.type === type) ?? FIELD_TYPES[0];
}

function createField(type: IntakeFieldType): IntakeFormField {
  const option = getFieldTypeOption(type);
  const id = createId();

  return {
    id,
    key: buildFieldKey(option.defaultLabel, id),
    type,
    label: option.defaultLabel,
    required: false,
    placeholder: option.defaultPlaceholder,
    options: option.hasOptions ? ["Option 1"] : undefined,
    validation: {},
    showIf: null,
  };
}

function QuestionCard({
  field,
  index,
  selected,
  allFields,
  onSelect,
  onUpdate,
  onDuplicate,
  onDelete,
}: {
  field: IntakeFormField;
  index: number;
  selected: boolean;
  allFields: IntakeFormField[];
  onSelect: () => void;
  onUpdate: (patch: Partial<IntakeFormField>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { ref, handleRef, isDragSource, isDropTarget } = useSortable({
    id: field.id,
    index,
  });

  const selectableShowIfFields = allFields.filter((item) => item.id !== field.id);

  const currentOptions = field.options ?? [];

  return (
    <Card
      ref={(node) => ref(node)}
      onClick={onSelect}
      className={cn(
        "relative overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm transition",
        selected && "ring-2 ring-[#4c8bf5]/40",
        isDragSource && "opacity-75",
        isDropTarget && "ring-2 ring-[#4c8bf5]/60"
      )}
    >
      {selected ? <div className="absolute left-0 top-0 h-full w-1 bg-[#4c8bf5]" /> : null}

      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <button
            ref={(node) => handleRef(node)}
            type="button"
            onClick={(event) => event.stopPropagation()}
            className="mt-1 rounded p-1 text-black/45 hover:bg-black/5 hover:text-black/70"
            aria-label="Drag question"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="flex-1 space-y-2">
            <Input
              value={field.label}
              onChange={(event) =>
                onUpdate({
                  label: event.target.value,
                  key: buildFieldKey(event.target.value, field.id),
                })
              }
              placeholder="Untitled question"
              className="border-0 border-b border-black/20 rounded-none px-0 focus-visible:ring-0"
            />

            {(field.type === "short_text" ||
              field.type === "long_text" ||
              field.type === "email" ||
              field.type === "number" ||
              field.type === "date") && (
              <Input
                value={field.placeholder ?? ""}
                onChange={(event) => onUpdate({ placeholder: event.target.value })}
                placeholder={
                  field.type === "long_text" ? "Long answer text" : "Short answer text"
                }
                className="border-0 border-b border-dashed border-black/15 rounded-none px-0 text-sm text-black/70 focus-visible:ring-0"
              />
            )}

            {field.type === "single_select" && (
              <div className="space-y-2 pt-1">
                {currentOptions.map((option, optionIndex) => (
                  <div key={`${field.id}-single-${optionIndex}`} className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border border-black/35" />
                    <Input
                      value={option}
                      onChange={(event) => {
                        const next = [...currentOptions];
                        next[optionIndex] = event.target.value;
                        onUpdate({ options: next });
                      }}
                      className="h-9 border-0 border-b border-black/15 rounded-none px-0 text-sm focus-visible:ring-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const next = currentOptions.filter((_, idx) => idx !== optionIndex);
                        onUpdate({ options: next.length ? next : ["Option 1"] });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 text-sm text-black/70"
                  onClick={() => onUpdate({ options: [...currentOptions, `Option ${currentOptions.length + 1}`] })}
                >
                  Add option
                </Button>
              </div>
            )}

            {field.type === "multi_select" && (
              <div className="space-y-2 pt-1">
                {currentOptions.map((option, optionIndex) => (
                  <div key={`${field.id}-multi-${optionIndex}`} className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded border border-black/35" />
                    <Input
                      value={option}
                      onChange={(event) => {
                        const next = [...currentOptions];
                        next[optionIndex] = event.target.value;
                        onUpdate({ options: next });
                      }}
                      className="h-9 border-0 border-b border-black/15 rounded-none px-0 text-sm focus-visible:ring-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const next = currentOptions.filter((_, idx) => idx !== optionIndex);
                        onUpdate({ options: next.length ? next : ["Option 1"] });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 text-sm text-black/70"
                  onClick={() => onUpdate({ options: [...currentOptions, `Option ${currentOptions.length + 1}`] })}
                >
                  Add option
                </Button>
              </div>
            )}

            {field.type === "checkbox" && (
              <p className="text-sm text-black/65">Participant checks this to confirm.</p>
            )}
          </div>

          <select
            value={field.type}
            className="h-10 rounded-md border border-black/20 bg-white px-3 text-sm"
            onChange={(event) => {
              const type = event.target.value as IntakeFieldType;
              const option = getFieldTypeOption(type);
              onUpdate({
                type,
                options: option.hasOptions ? field.options ?? ["Option 1"] : undefined,
                placeholder: option.defaultPlaceholder,
              });
            }}
          >
            {FIELD_TYPES.map((option) => (
              <option key={option.type} value={option.type}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {selected ? (
          <div className="rounded-lg bg-[#f8f9fa] p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-black/55">
              Advanced (optional)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-black/60">Show this question only if</label>
                <select
                  value={field.showIf?.fieldKey ?? ""}
                  className="h-9 w-full rounded-md border border-black/20 bg-white px-2 text-sm"
                  onChange={(event) => {
                    if (!event.target.value) {
                      onUpdate({ showIf: null });
                      return;
                    }

                    onUpdate({
                      showIf: {
                        fieldKey: event.target.value,
                        equals: field.showIf?.equals ?? "",
                      },
                    });
                  }}
                >
                  <option value="">Always show</option>
                  {selectableShowIfFields.map((item) => (
                    <option key={item.id} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              {field.showIf ? (
                <div className="space-y-1">
                  <label className="text-xs text-black/60">Value equals</label>
                  <Input
                    value={field.showIf.equals}
                    onChange={(event) =>
                      onUpdate({
                        showIf: {
                          fieldKey: field.showIf?.fieldKey ?? "",
                          equals: event.target.value,
                        },
                      })
                    }
                    className="h-9"
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-black/10 pt-3">
          <Button type="button" variant="ghost" size="icon" onClick={onDuplicate}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-5 w-px bg-black/15" />
          <span className="text-sm text-black/75">Required</span>
          <Switch
            checked={field.required}
            onCheckedChange={(checked) => onUpdate({ required: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function IntakeFormBuilder({
  eventId,
  context = "project_submission",
  className,
}: IntakeFormBuilderProps) {
  const { toast } = useToast();
  const [schema, setSchema] = useState<IntakeFormSchema>(DEFAULT_SCHEMA);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newFieldType, setNewFieldType] = useState<IntakeFieldType>("single_select");
  const [lastPublished, setLastPublished] = useState<LastPublishedState>(null);

  const selectedField = useMemo(
    () => schema.fields.find((field) => field.id === selectedFieldId) ?? null,
    [schema.fields, selectedFieldId]
  );

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/events/${eventId}/intake-forms?context=${context}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to load intake form");
        }

        const data = (await response.json()) as {
          schema?: IntakeFormSchema;
          lastPublished?: LastPublishedState;
        };

        const nextSchema = data.schema ?? DEFAULT_SCHEMA;
        setSchema(nextSchema);
        setSelectedFieldId(nextSchema.fields[0]?.id ?? null);
        setLastPublished(data.lastPublished ?? null);
      } catch (error) {
        toast({
          title: "Could not load intake form",
          description:
            error instanceof Error ? error.message : "Please refresh and try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [eventId, context, toast]);

  function addField(type: IntakeFieldType) {
    const field = createField(type);
    setSchema((current) => ({
      ...current,
      fields: [...current.fields, field],
    }));
    setSelectedFieldId(field.id);
  }

  function updateField(id: string, patch: Partial<IntakeFormField>) {
    setSchema((current) => ({
      ...current,
      fields: current.fields.map((field) =>
        field.id === id
          ? {
              ...field,
              ...patch,
            }
          : field
      ),
    }));
  }

  function removeField(id: string) {
    setSchema((current) => ({
      ...current,
      fields: current.fields.filter((field) => field.id !== id),
    }));

    if (selectedFieldId === id) {
      const remaining = schema.fields.filter((field) => field.id !== id);
      setSelectedFieldId(remaining[0]?.id ?? null);
    }
  }

  function duplicateField(id: string) {
    setSchema((current) => {
      const index = current.fields.findIndex((field) => field.id === id);
      if (index < 0) return current;

      const source = current.fields[index];
      const duplicateId = createId();
      const duplicated: IntakeFormField = {
        ...source,
        id: duplicateId,
        key: buildFieldKey(source.label, duplicateId),
      };

      const next = [...current.fields];
      next.splice(index + 1, 0, duplicated);
      setSelectedFieldId(duplicated.id);
      return { ...current, fields: next };
    });
  }

  const reorderFields: NonNullable<
    ComponentProps<typeof DragDropProvider>["onDragEnd"]
  > = (event) => {
    if (event.canceled) return;

    const sourceId = event.operation.source?.id;
    const targetId = event.operation.target?.id;

    if (!sourceId || !targetId || sourceId === targetId) return;

    setSchema((current) => {
      const fromIndex = current.fields.findIndex((field) => field.id === sourceId);
      const toIndex = current.fields.findIndex((field) => field.id === targetId);

      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;

      return {
        ...current,
        fields: arrayMove(current.fields, fromIndex, toIndex),
      };
    });
  };

  async function saveDraft() {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/events/${eventId}/intake-forms`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, schema }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save draft");
      }

      toast({ title: "Draft saved" });
    } catch (error) {
      toast({
        title: "Could not save draft",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function publish() {
    setIsPublishing(true);

    try {
      const response = await fetch(`/api/events/${eventId}/intake-forms/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, schema }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to publish form");
      }

      const data = (await response.json()) as {
        lastPublished?: LastPublishedState;
      };
      setLastPublished(data.lastPublished ?? null);
      toast({ title: "Form published" });
    } catch (error) {
      toast({
        title: "Could not publish form",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  }

  function applyMLHTemplate() {
    const template = createMLHComplianceTemplate();
    setSchema(template);
    setSelectedFieldId(template.fields[0]?.id ?? null);
  }

  async function deleteQuestionnaire() {
    const confirmed = window.confirm(
      "Delete this questionnaire for this context? This will unpublish/archive it and participants will no longer see it."
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/events/${eventId}/intake-forms?context=${context}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete questionnaire");
      }

      setSchema(DEFAULT_SCHEMA);
      setSelectedFieldId(null);
      setLastPublished(null);
      toast({ title: "Questionnaire deleted" });
    } catch (error) {
      toast({
        title: "Could not delete questionnaire",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className={cn("relative rounded-2xl bg-[#eaf2ff] p-4 md:p-6", className)}>
      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="overflow-hidden rounded-xl border border-black/10 shadow-sm">
          <div className="h-2 w-full bg-[#4B89EF]" />
          <CardContent className="space-y-3 p-6">
            <Input
              value={schema.title}
              onChange={(event) =>
                setSchema((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Untitled form"
              className="border-0 px-0 text-3xl font-medium focus-visible:ring-0"
              disabled={isLoading}
            />
            <Textarea
              value={schema.description ?? ""}
              onChange={(event) =>
                setSchema((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Form description"
              className="min-h-[48px] border-0 px-0 text-base text-black/70 focus-visible:ring-0"
              disabled={isLoading}
            />
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="rounded-full bg-black/5 px-3 py-1 text-xs text-black/70">
                {context === "registration"
                  ? "Registration intake"
                  : context === "rsvp"
                    ? "RSVP form"
                    : "Project submission intake"}
              </span>
              <span className="rounded-full bg-[#4B89EF]/10 px-3 py-1 text-xs text-[#2459ad]">
                {lastPublished
                  ? `Last published: v${lastPublished.versionNumber} • ${new Date(
                      lastPublished.publishedAt
                    ).toLocaleString()}`
                  : "Last published: never"}
              </span>
              {/* MLH template only applies to registration forms */}
              {context === "registration" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 px-3"
                      disabled={isSaving || isPublishing || isDeleting || isLoading}
                    >
                      <ShieldCheck className="mr-1.5 h-4 w-4" />
                      Apply MLH Template
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Apply MLH Compliance Template?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will replace the current form title, description, and all questions with the MLH-required registration fields. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={applyMLHTemplate}>
                        Apply template
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button
                type="button"
                variant="destructive"
                className="h-9 px-3"
                onClick={deleteQuestionnaire}
                disabled={isSaving || isPublishing || isDeleting || isLoading}
              >
                {isDeleting ? "Deleting..." : "Delete questionnaire"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3"
                onClick={saveDraft}
                disabled={isSaving || isPublishing || isDeleting || isLoading}
              >
                {isSaving ? "Saving..." : "Save draft"}
              </Button>
              <Button
                type="button"
                className="h-9 bg-[#4B89EF] px-3 text-white hover:bg-[#3E7EEA]"
                onClick={publish}
                disabled={isSaving || isPublishing || isDeleting || isLoading}
              >
                {isPublishing ? "Publishing..." : "Publish"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card className="rounded-xl border border-black/10 bg-white">
            <CardContent className="p-6 text-sm text-black/60">Loading form...</CardContent>
          </Card>
        ) : schema.fields.length === 0 ? (
          <Card className="rounded-xl border border-dashed border-black/20 bg-white">
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
              <FileText className="h-5 w-5 text-black/45" />
              <p className="text-sm text-black/70">No questions yet</p>
              <Button
                type="button"
                variant="outline"
                className="h-9"
                onClick={() => addField(newFieldType)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add first question
              </Button>
            </CardContent>
          </Card>
        ) : (
          <DragDropProvider onDragEnd={reorderFields}>
            <div className="space-y-3">
              {schema.fields.map((field, index) => (
                <QuestionCard
                  key={field.id}
                  field={field}
                  index={index}
                  allFields={schema.fields}
                  selected={selectedField?.id === field.id}
                  onSelect={() => setSelectedFieldId(field.id)}
                  onUpdate={(patch) => updateField(field.id, patch)}
                  onDuplicate={() => duplicateField(field.id)}
                  onDelete={() => removeField(field.id)}
                />
              ))}
            </div>
          </DragDropProvider>
        )}
      </div>

      <div className="sticky bottom-6 ml-auto mt-4 flex w-fit items-center gap-2 rounded-xl border border-black/10 bg-white p-2 shadow">
        <ListChecks className="ml-1 h-4 w-4 text-black/50" />
        <select
          value={newFieldType}
          className="h-9 rounded-md border border-black/20 bg-white px-2 text-sm"
          onChange={(event) => setNewFieldType(event.target.value as IntakeFieldType)}
        >
          {FIELD_TYPES.map((type) => (
            <option key={type.type} value={type.type}>
              {type.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          className="h-9 bg-[#4B89EF] px-3 text-white hover:bg-[#3E7EEA]"
          onClick={() => addField(newFieldType)}
          disabled={isLoading}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>
    </div>
  );
}
