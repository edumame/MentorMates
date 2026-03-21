"use client";

import { Fragment } from "react";
import { Image as ImageIcon, Paperclip, Text, Video } from "lucide-react";
import { TextFields } from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProjectDescription } from "@/components/projects/ProjectDescription";
import type {
  EffectiveSubmissionField,
  SubmissionValue,
} from "@/features/projects/utils/effectiveSubmission";

interface ProjectSubmissionSchemaSectionProps {
  fields: EffectiveSubmissionField[];
  values: Record<string, SubmissionValue>;
  onValueChange: (key: string, value: SubmissionValue) => void;
  onFileUpload: (key: string, file: File) => Promise<void> | void;
  showDescriptionPreview: boolean;
  onToggleDescriptionPreview: () => void;
}

function getTextValue(value: SubmissionValue | undefined): string {
  if (typeof value === "string") {
    return value;
  }

  return "";
}

function getListValue(value: SubmissionValue | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return [value];
  }

  return [];
}

function getFieldOptions(options: unknown): string[] {
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .map((option) => (typeof option === "string" ? option.trim() : ""))
    .filter((option) => option.length > 0);
}

function getFieldIcon(fieldKey: string) {
  switch (fieldKey) {
    case "project_name":
      return (
        <TextFields className="shrink-0 text-gray-500" sx={{ fontSize: 16 }} />
      );
    case "project_url":
      return <Text className="h-4 w-4 shrink-0 text-gray-500" />;
    case "video_url":
      return <Video className="h-4 w-4 shrink-0 text-gray-500" />;
    case "cover_image":
      return <ImageIcon className="h-4 w-4 shrink-0 text-gray-500" />;
    default:
      return <Paperclip className="h-4 w-4 shrink-0 text-gray-500" />;
  }
}

export function ProjectSubmissionSchemaSection({
  fields,
  values,
  onValueChange,
  onFileUpload,
  showDescriptionPreview,
  onToggleDescriptionPreview,
}: ProjectSubmissionSchemaSectionProps) {
  return (
    <div className="space-y-4">
      {fields.map((field, index) => {
        const labelSuffix = field.required ? "" : " (Optional)";
        const textValue = getTextValue(values[field.key]);
        const listValue =
          field.field_type === "multi_url" || field.field_type === "multi_select"
            ? getListValue(values[field.key])
            : [];

        return (
          <Fragment key={field.id}>
            <div className="space-y-2">
              <label className="text-base text-black font-normal">
                {field.label}
                {labelSuffix}
              </label>
              {field.description ? (
                <p className="text-base text-[#7f7f7f]">{field.description}</p>
              ) : null}

              {field.field_type === "long_text" ? (
                <>
                  <Textarea
                    value={textValue}
                    onChange={(event) => onValueChange(field.key, event.target.value)}
                    placeholder={field.placeholder || ""}
                    rows={7}
                    className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 text-base resize-none"
                  />
                  {field.key === "project_description" && textValue.trim() ? (
                    <>
                      <button
                        type="button"
                        onClick={onToggleDescriptionPreview}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        {showDescriptionPreview ? "Hide preview" : "Show preview"}
                      </button>
                      {showDescriptionPreview ? (
                        <div className="rounded-xl border border-[rgba(0,0,0,0.12)] bg-white px-3 py-3">
                          <p className="text-xs font-medium text-gray-500 mb-2">
                            Preview
                          </p>
                          <ProjectDescription value={textValue} className="text-base" />
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : field.field_type === "multi_url" ? (
                <div className="space-y-2">
                  {(listValue.length > 0 ? listValue : [""]).map((url, itemIndex) => (
                    <div key={`${field.id}-${itemIndex}`} className="flex gap-2">
                      <Input
                        value={url}
                        onChange={(event) => {
                          const nextValues =
                            listValue.length > 0 ? [...listValue] : [""];
                          nextValues[itemIndex] = event.target.value;
                          onValueChange(field.key, nextValues);
                        }}
                        placeholder={field.placeholder || "https://..."}
                        className="h-11"
                      />
                      {field.key === "additional_materials" ? (
                        <label className="bg-[rgba(0,0,0,0.05)] shadow-sm rounded-xl px-3 py-1 cursor-pointer shrink-0 h-11 inline-flex items-center">
                          <input
                            type="file"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (!file) return;
                              void onFileUpload(field.key, file);
                              event.currentTarget.value = "";
                            }}
                            className="hidden"
                          />
                          <span className="text-xs text-black font-normal">
                            Upload
                          </span>
                        </label>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const nextValues = (listValue.length > 0 ? listValue : [""]).filter(
                            (_, currentIndex) => currentIndex !== itemIndex
                          );
                          onValueChange(field.key, nextValues);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onValueChange(field.key, [...listValue, ""])}
                  >
                    Add another link
                  </Button>
                </div>
              ) : field.field_type === "file" ? (
                <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                  {getFieldIcon(field.key)}
                  <Input
                    value={textValue}
                    onChange={(event) => onValueChange(field.key, event.target.value)}
                    placeholder={field.placeholder || "https://..."}
                    className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base truncate"
                  />
                  <label className="bg-[rgba(0,0,0,0.05)] shadow-sm rounded-xl px-3 py-1 cursor-pointer shrink-0">
                    <input
                      type="file"
                      accept={field.key === "cover_image" ? "image/*" : undefined}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        void onFileUpload(field.key, file);
                        event.currentTarget.value = "";
                      }}
                      className="hidden"
                    />
                    <span className="text-xs text-black font-normal">Upload</span>
                  </label>
                </div>
              ) : field.field_type === "select" ? (
                <div className="space-y-2">
                  {getFieldOptions(field.options).map((option) => (
                      <label key={option} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={field.id}
                          checked={textValue === option}
                          onChange={() => onValueChange(field.key, option)}
                          className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-black">{option}</span>
                      </label>
                    )
                  )}
                </div>
              ) : field.field_type === "multi_select" ? (
                <div className="space-y-2">
                  {getFieldOptions(field.options).map((option) => (
                      <label key={option} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={listValue.includes(option)}
                          onChange={(event) => {
                            const nextValues = event.target.checked
                              ? [...listValue, option]
                              : listValue.filter((value) => value !== option);
                            onValueChange(field.key, nextValues);
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-black">{option}</span>
                      </label>
                    )
                  )}
                </div>
              ) : field.field_type === "checkbox" ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={textValue === "true"}
                    onChange={(event) =>
                      onValueChange(field.key, event.target.checked ? "true" : "")
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-base text-black">
                    {getFieldOptions(field.options)[0] || field.placeholder || "Yes"}
                  </span>
                </label>
              ) : (
                <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                  {getFieldIcon(field.key)}
                  <Input
                    type={field.field_type === "url" ? "url" : "text"}
                    value={textValue}
                    onChange={(event) => onValueChange(field.key, event.target.value)}
                    placeholder={field.placeholder || ""}
                    className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
                  />
                </div>
              )}
            </div>
            {index < fields.length - 1 ? (
              <div className="border-t border-dashed border-gray-200" />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
