"use client";

import { useState } from "react";
import { Pencil, Eye } from "lucide-react";
import type { SubmissionField } from "./types";
import { createSubmissionTemplateFields } from "./types";
import { SubmissionEditor } from "./SubmissionEditor";
import { SubmissionFormPreview } from "./SubmissionFormPreview";

interface SubmissionStepProps {
  fields: SubmissionField[];
  onChange: (fields: SubmissionField[]) => void;
}

export function SubmissionStep({ fields, onChange }: SubmissionStepProps) {
  const [stepMode, setStepMode] = useState<"edit" | "preview">("edit");
  const previewFields =
    fields.length > 0 ? fields : createSubmissionTemplateFields();

  return (
    <div className="space-y-6 w-full">
      {/* Top bar: Edit/Preview toggle */}
      <div className="flex items-center justify-between">
        <h2 className="font-geist text-lg font-semibold tracking-[-0.06em] text-gray-900">
          Submission Form
        </h2>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <button
            type="button"
            onClick={() => setStepMode("edit")}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              stepMode === "edit"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Pencil className="size-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setStepMode("preview")}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              stepMode === "preview"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Eye className="size-3.5" />
            Preview
          </button>
        </div>
      </div>

      {stepMode === "preview" ? (
        <SubmissionFormPreview fields={previewFields} />
      ) : (
        <SubmissionEditor fields={fields} onChange={onChange} />
      )}
    </div>
  );
}
