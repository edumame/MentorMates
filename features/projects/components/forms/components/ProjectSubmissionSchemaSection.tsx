"use client";

import { Fragment } from "react";
import {
  FileIcon,
  Image as ImageIcon,
  Paperclip,
  Text,
  Upload,
  Video,
  X,
} from "lucide-react";
import { TextFields } from "@mui/icons-material";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProjectDescription } from "@/components/projects/ProjectDescription";
import type {
  EffectiveSubmissionField,
  SubmissionValue,
} from "@/features/projects/utils/effectiveSubmission";
import { isMultiValueSubmissionFieldType } from "@/features/projects/utils/submission";
import { getFileNameFromUrl } from "@/lib/utils/file";

interface ProjectSubmissionSchemaSectionProps {
  fields: EffectiveSubmissionField[];
  values: Record<string, SubmissionValue>;
  onValueChange: (key: string, value: SubmissionValue) => void;
  onFileUpload: (key: string, files: File[]) => Promise<void> | void;
  showDescriptionPreview: boolean;
  onToggleDescriptionPreview: () => void;
}

const DEFAULT_MAX_FILES = 5;

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
        const listValue = isMultiValueSubmissionFieldType(field.field_type)
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
                              void onFileUpload(field.key, [file]);
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
              ) : field.field_type === "multi_file" ? (
                <MultiFileUploadField
                  field={field}
                  urls={listValue}
                  onUpload={(files) => void onFileUpload(field.key, files)}
                  onRemove={(itemIndex) =>
                    onValueChange(
                      field.key,
                      listValue.filter(
                        (_, currentIndex) => currentIndex !== itemIndex
                      )
                    )
                  }
                />
              ) : field.field_type === "file" ? (
                field.key === "cover_image" ? (
                  <div className="space-y-2">
                    <div className="flex min-h-11 flex-wrap items-center gap-3 rounded-xl border border-[rgba(0,0,0,0.15)] bg-white px-3 py-2">
                      {getFieldIcon(field.key)}
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {textValue.trim() ? (
                          <>
                            <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-gray-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={textValue}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <span
                              className="min-w-0 truncate text-base text-black"
                              title={getFileNameFromUrl(textValue)}
                            >
                              {getFileNameFromUrl(textValue)}
                            </span>
                          </>
                        ) : (
                          <span className="text-base text-[rgba(0,0,0,0.45)]">
                            No cover image
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <label className="inline-flex h-9 cursor-pointer items-center rounded-xl bg-[rgba(0,0,0,0.05)] px-3 py-1 shadow-sm">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (!file) return;
                              void onFileUpload(field.key, [file]);
                              event.currentTarget.value = "";
                            }}
                            className="hidden"
                          />
                          <span className="text-xs font-normal text-black">
                            Upload
                          </span>
                        </label>
                        {textValue.trim() ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-xl text-xs"
                            onClick={() => onValueChange(field.key, "")}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-11 items-center gap-3 rounded-xl border border-[rgba(0,0,0,0.15)] bg-white px-3 py-2">
                    {getFieldIcon(field.key)}
                    <Input
                      value={textValue}
                      onChange={(event) =>
                        onValueChange(field.key, event.target.value)
                      }
                      placeholder={field.placeholder || "https://..."}
                      className="h-auto border-0 p-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0 truncate"
                    />
                    <label className="shrink-0 cursor-pointer rounded-xl bg-[rgba(0,0,0,0.05)] px-3 py-1 shadow-sm">
                      <input
                        type="file"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          void onFileUpload(field.key, [file]);
                          event.currentTarget.value = "";
                        }}
                        className="hidden"
                      />
                      <span className="text-xs font-normal text-black">
                        Upload
                      </span>
                    </label>
                  </div>
                )
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

function MultiFileUploadField({
  field,
  urls,
  onUpload,
  onRemove,
}: {
  field: EffectiveSubmissionField;
  urls: string[];
  onUpload: (files: File[]) => void;
  onRemove: (index: number) => void;
}) {
  const maxFiles = field.max_files ?? DEFAULT_MAX_FILES;
  const remainingSlots = Math.max(0, maxFiles - urls.length);
  const canAdd = remainingSlots > 0;

  return (
    <div className="space-y-2">
      <label
        className={`w-full border-2 border-dashed rounded-xl py-6 flex flex-col items-center gap-2 transition-colors ${
          canAdd
            ? "border-gray-200 hover:border-[#4b89ef] hover:bg-blue-50/30 cursor-pointer"
            : "border-gray-100 bg-gray-50 cursor-not-allowed"
        }`}
      >
        <input
          type="file"
          multiple
          disabled={!canAdd}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []).slice(
              0,
              remainingSlots
            );
            if (files.length > 0) {
              onUpload(files);
            }
            event.currentTarget.value = "";
          }}
          className="hidden"
        />
        <Upload
          className={`h-8 w-8 ${canAdd ? "text-gray-400" : "text-gray-300"}`}
        />
        <div className="text-center">
          <p
            className={`text-sm font-medium ${canAdd ? "text-gray-700" : "text-gray-400"}`}
          >
            {canAdd ? "Click to upload files" : "Maximum files reached"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {urls.length}/{maxFiles} files uploaded
          </p>
        </div>
      </label>

      {urls.length > 0 ? (
        <div className="space-y-1.5">
          {urls.map((url, itemIndex) => (
            <div
              key={`${field.id}-file-${itemIndex}`}
              className="flex items-center gap-3 bg-white border border-[rgba(0,0,0,0.1)] rounded-lg px-3 py-2"
            >
              <FileIcon className="h-5 w-5 text-gray-400 shrink-0" />
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-gray-900 flex-1 truncate hover:underline"
                title={getFileNameFromUrl(url)}
              >
                {getFileNameFromUrl(url)}
              </a>
              <button
                type="button"
                onClick={() => onRemove(itemIndex)}
                aria-label={`Remove file ${itemIndex + 1}`}
                className="shrink-0 rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
