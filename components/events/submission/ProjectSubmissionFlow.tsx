"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { EventSubmissionField } from "@/lib/types";
import { ProjectImport } from "@/features/user/dashboards/dashboard/organizer/import/ProjectImportButton";
import { SubmissionsTab } from "@/features/user/dashboards/dashboard/organizer/submissions";
import { SubmissionEditor } from "./SubmissionEditor";
import { ProjectSubmissionFormPreview } from "./ProjectSubmissionFormPreview";
import {
  apiFieldsToEditor,
  DEFAULT_SUBMISSION_FIELDS,
  fieldsToApiPayload,
  mergeWithDefaultSubmissionFields,
  SubmissionField,
} from "./types";

interface ProjectSubmissionFlowProps {
  eventId: string;
}

const cloneDefaultSubmissionFields = (): SubmissionField[] =>
  DEFAULT_SUBMISSION_FIELDS.map((field) => ({
    ...field,
    options: field.options ? [...field.options] : undefined,
  }));

export function ProjectSubmissionFlow({ eventId }: ProjectSubmissionFlowProps) {
  const { toast } = useToast();
  const [fields, setFields] = useState<SubmissionField[]>([]);
  const [savedFields, setSavedFields] = useState<SubmissionField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    const loadFields = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/events/${eventId}/submission-fields`,
        );
        if (!response.ok) {
          throw new Error("Failed to fetch submission fields");
        }

        const json = (await response.json()) as {
          fields?: EventSubmissionField[];
        };
        const nextFields = mergeWithDefaultSubmissionFields(
          json.fields && json.fields.length > 0
            ? apiFieldsToEditor(json.fields)
            : cloneDefaultSubmissionFields(),
        );

        setFields(nextFields);
        setSavedFields(nextFields);
      } catch (error) {
        const fallback = cloneDefaultSubmissionFields();
        setFields(fallback);
        setSavedFields(fallback);
        toast({
          title: "Error",
          description: "Failed to load project submission settings.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadFields();
  }, [eventId, toast]);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(fields) !== JSON.stringify(savedFields),
    [fields, savedFields],
  );

  const handleReset = () => {
    const defaults = cloneDefaultSubmissionFields();
    setFields(defaults);
  };

  const handleSave = async () => {
    const normalizedFields = fields.map((field) => ({
      ...field,
      options: field.options
        ? field.options.map((option) => option.trim()).filter(Boolean)
        : undefined,
    }));

    const invalidField = fields.find(
      (field) =>
        field.label.trim().length === 0 ||
        ((field.type === "select" || field.type === "multi_select") &&
          (!field.options || field.options.every((option) => !option.trim()))),
    );

    if (invalidField) {
      toast({
        title: "Validation error",
        description:
          "Each field needs a label, and choice fields need at least one option.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = { fields: fieldsToApiPayload(normalizedFields) };
      const response = await fetch(`/api/events/${eventId}/submission-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || "Failed to save submission fields");
      }

      const json = (await response.json()) as {
        fields?: EventSubmissionField[];
      };
      const nextFields = mergeWithDefaultSubmissionFields(
        json.fields && json.fields.length > 0
          ? apiFieldsToEditor(json.fields)
          : cloneDefaultSubmissionFields(),
      );

      setFields(nextFields);
      setSavedFields(nextFields);

      toast({
        title: "Saved",
        description: "Project submission flow updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save project submission flow.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[rgba(0,0,0,0.15)] bg-white p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-black">
              Project Submission Flow
            </h2>
            <p className="text-sm text-[#7f7f7f] max-w-2xl">
              Define the exact questions and required assets participants see
              when they submit a project. Changes here drive both new
              submissions and draft edits.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              <button
                type="button"
                onClick={() => setMode("edit")}
                className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  mode === "edit"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Pencil className="size-3.5" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  mode === "preview"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Eye className="size-3.5" />
                Preview
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isLoading || isSaving}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to defaults
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isLoading || isSaving || !hasUnsavedChanges}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save flow
            </Button>
          </div>
        </div>
        {hasUnsavedChanges ? (
          <p className="mt-3 text-sm text-[#4b89ef]">
            You have unsaved submission flow changes.
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-[rgba(0,0,0,0.15)] bg-white py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#4b89ef]" />
        </div>
      ) : mode === "preview" ? (
        <ProjectSubmissionFormPreview fields={fields} />
      ) : (
        <SubmissionEditor fields={fields} onChange={setFields} />
      )}

      <div className="border-t border-[rgba(0,0,0,0.15)] pt-6">
        <SubmissionsTab eventId={eventId} />
      </div>

      <div className="border-t border-[rgba(0,0,0,0.15)] pt-6">
        <h2 className="mb-4 text-xl font-semibold text-black">
          Import Projects
        </h2>
        <ProjectImport eventId={eventId} />
      </div>
    </div>
  );
}
