"use client";

import {
  Paperclip,
  FileText,
  AlignLeft,
  Link,
  List,
  CheckCircle,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import type { SubmissionField } from "./types";

// ── Constants ──────────────────────────────────────────────────────────

export const FIELD_TYPE_OPTIONS: { value: SubmissionField["type"]; label: string }[] = [
  { value: "text", label: "Short Text" },
  { value: "textarea", label: "Long Text" },
  { value: "url", label: "URL" },
  { value: "file", label: "File Upload" },
  { value: "select", label: "Single Choice" },
  { value: "multi_select", label: "Multi Select" },
  { value: "checkbox", label: "Checkbox" },
];

export const FIELD_TYPE_ICONS: Record<SubmissionField["type"], LucideIcon> = {
  text: AlignLeft,
  textarea: FileText,
  url: Link,
  file: Paperclip,
  select: ChevronDown,
  multi_select: List,
  checkbox: CheckCircle,
};

/** Fields that are always present and cannot be removed */
export const LOCKED_FIELD_IDS = ["project_name", "project_description"];

/** All built-in template field IDs (includes locked + removable) */
export const TEMPLATE_FIELD_IDS = [
  "project_name",
  "project_description",
  "tracks",
  "cover_image",
  "additional_materials",
  "project_url",
  "video_url",
];

// ── Toggle Option (checkbox style) ─────────────────────────────────────

export function ToggleOption({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-gray-300 text-[#4B89EF] focus:ring-blue-500"
      />
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </label>
  );
}
