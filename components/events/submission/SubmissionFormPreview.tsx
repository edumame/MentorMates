"use client";

import { useState } from "react";
import {
  Paperclip,
  X,
  Plus,
  Upload,
  FileIcon,
} from "lucide-react";
import type { SubmissionField } from "./types";
import { FIELD_TYPE_ICONS, LOCKED_FIELD_IDS } from "./SubmissionHelpers";

interface SubmissionFormPreviewProps {
  fields: SubmissionField[];
}

export function SubmissionFormPreview({ fields }: SubmissionFormPreviewProps) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [multiValues, setMultiValues] = useState<Record<string, string[]>>({});
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<string, { name: string; size: string }[]>
  >({});

  const setValue = (id: string, value: string) =>
    setFieldValues((prev) => ({ ...prev, [id]: value }));

  const getMultiValues = (id: string) => multiValues[id] || [""];
  const setMultiValue = (id: string, index: number, value: string) =>
    setMultiValues((prev) => {
      const arr = [...(prev[id] || [""])];
      arr[index] = value;
      return { ...prev, [id]: arr };
    });
  const addMultiValue = (id: string) =>
    setMultiValues((prev) => ({
      ...prev,
      [id]: [...(prev[id] || [""]), ""],
    }));
  const removeMultiValue = (id: string, index: number) =>
    setMultiValues((prev) => {
      const arr = (prev[id] || [""]).filter((_, i) => i !== index);
      return { ...prev, [id]: arr.length ? arr : [""] };
    });

  const getUploadedFiles = (id: string) => uploadedFiles[id] || [];
  const addUploadedFile = (id: string) => {
    const fakeFiles = [
      { name: "screenshot.png", size: "1.2 MB" },
      { name: "architecture.pdf", size: "340 KB" },
      { name: "demo-video.mp4", size: "8.4 MB" },
    ];
    const existing = uploadedFiles[id] || [];
    const next = fakeFiles[existing.length % fakeFiles.length];
    setUploadedFiles((prev) => ({
      ...prev,
      [id]: [...existing, next],
    }));
  };
  const removeUploadedFile = (id: string, index: number) =>
    setUploadedFiles((prev) => ({
      ...prev,
      [id]: (prev[id] || []).filter((_, i) => i !== index),
    }));

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-[rgba(0,0,0,0.15)]">
      <div className="bg-sky-50 border-b border-[#d8d8d8]">
        <div className="px-6 py-3.5 flex items-center gap-2">
          <p className="text-[#4c4c4c] text-base font-medium tracking-[-0.06em]">
            Preview: what participants will see
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-100/45 via-transparent to-transparent">
        <div className="px-4 py-4 min-h-[400px] sm:px-8 sm:py-6">
          <div className="space-y-1 mb-6">
            <h1 className="text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
              Create your project
            </h1>
            <p className="text-base text-black">
              Start building your project with automatic saving as you go.
            </p>
          </div>

          <div className="space-y-4">
            {fields.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-600">
                No submission requirements yet. Add fields in Edit mode to preview them here.
              </div>
            )}
            {fields.map((field, idx) => {
              const FieldIcon = FIELD_TYPE_ICONS[field.type];
              const isLocked = LOCKED_FIELD_IDS.includes(field.id);
              const isOptional = !field.required && !isLocked;
              const prevField = fields[idx - 1];
              const showDivider =
                idx > 0 &&
                !isLocked &&
                LOCKED_FIELD_IDS.includes(prevField?.id ?? "");

              return (
                <div key={field.id}>
                  {showDivider && (
                    <div className="border-t border-dashed border-gray-200 mb-4" />
                  )}

                  <div className="space-y-2">
                    <label className="text-base text-black font-normal">
                      {field.label}
                      {isOptional && (
                        <span className="text-[#7f7f7f]"> (Optional)</span>
                      )}
                    </label>

                    {field.type === "textarea" ? (
                      <>
                        <textarea
                          value={fieldValues[field.id] || ""}
                          onChange={(e) => setValue(field.id, e.target.value)}
                          placeholder={
                            field.placeholder ||
                            `Enter ${field.label.toLowerCase()}`
                          }
                          rows={7}
                          className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 text-base resize-none w-full outline-none placeholder:text-[rgba(0,0,0,0.35)] focus:border-[#4b89ef] focus:ring-1 focus:ring-[#4b89ef] transition-colors"
                        />
                        {field.helperText && (
                          <p className="text-base text-[#7f7f7f]">
                            {field.helperText}
                          </p>
                        )}
                      </>
                    ) : field.type === "file" && field.multiple ? (
                      <MultiFileField
                        field={field}
                        files={getUploadedFiles(field.id)}
                        onAddFile={() => addUploadedFile(field.id)}
                        onRemoveFile={(i) => removeUploadedFile(field.id, i)}
                      />
                    ) : field.type === "file" ? (
                      <>
                        <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                          <Paperclip className="h-6 w-6 shrink-0" />
                          <input
                            type="text"
                            value={fieldValues[field.id] || ""}
                            onChange={(e) =>
                              setValue(field.id, e.target.value)
                            }
                            placeholder={field.placeholder || "https://..."}
                            className="flex-1 border-0 p-0 h-auto text-base outline-none bg-transparent truncate placeholder:text-[rgba(0,0,0,0.35)]"
                          />
                          <label className="bg-[rgba(0,0,0,0.05)] shadow-sm rounded-xl px-3 py-1 cursor-pointer shrink-0">
                            <span className="text-xs text-black font-normal">
                              Upload
                            </span>
                          </label>
                        </div>
                        {field.helperText && (
                          <p className="text-base text-[#7f7f7f]">
                            {field.helperText}
                          </p>
                        )}
                      </>
                    ) : field.type === "url" && field.multiple ? (
                      <MultiUrlField
                        field={field}
                        values={getMultiValues(field.id)}
                        onChangeValue={(i, v) =>
                          setMultiValue(field.id, i, v)
                        }
                        onAdd={() => addMultiValue(field.id)}
                        onRemove={(i) => removeMultiValue(field.id, i)}
                      />
                    ) : field.type === "select" ? (
                      <>
                        <div className="space-y-2">
                          {(
                            (field.options || [])
                              .map((option) => option.trim())
                              .filter((option) => option.length > 0)
                              .length > 0
                              ? (field.options || [])
                                  .map((option) => option.trim())
                                  .filter((option) => option.length > 0)
                              : ["Option 1", "Option 2"]
                          ).map(
                            (opt, i) => (
                              <label
                                key={i}
                                className="flex items-center gap-2"
                              >
                                <input
                                  type="radio"
                                  name={field.id}
                                  className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-black">
                                  {opt}
                                </span>
                              </label>
                            )
                          )}
                        </div>
                        {field.helperText && (
                          <p className="text-base text-[#7f7f7f]">
                            {field.helperText}
                          </p>
                        )}
                      </>
                    ) : field.type === "multi_select" ? (
                      <div className="space-y-2">
                        {(
                          (field.options || [])
                            .map((option) => option.trim())
                            .filter((option) => option.length > 0)
                            .length > 0
                            ? (field.options || [])
                                .map((option) => option.trim())
                                .filter((option) => option.length > 0)
                            : ["Option 1", "Option 2"]
                        ).map(
                          (opt, i) => (
                            <label
                              key={i}
                              className="flex items-center gap-2"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-black">
                                {opt}
                              </span>
                            </label>
                          )
                        )}
                      </div>
                    ) : field.type === "checkbox" ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-base text-black">
                          {(field.options || [])
                            .map((option) => option.trim())
                            .filter((option) => option.length > 0)[0] ||
                            field.placeholder ||
                            "Yes"}
                        </span>
                      </label>
                    ) : (
                      <>
                        <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
                          <FieldIcon className="h-6 w-6 shrink-0" />
                          <input
                            type={field.type === "url" ? "url" : "text"}
                            value={fieldValues[field.id] || ""}
                            onChange={(e) =>
                              setValue(field.id, e.target.value)
                            }
                            placeholder={
                              field.placeholder ||
                              `Enter ${field.label.toLowerCase()}`
                            }
                            className="flex-1 border-0 p-0 h-auto text-base outline-none bg-transparent placeholder:text-[rgba(0,0,0,0.35)]"
                          />
                        </div>
                        {field.helperText && (
                          <p className="text-base text-[#7f7f7f]">
                            {field.helperText}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Multi-URL repeatable rows ─────────────────────────────────────────

function MultiUrlField({
  field,
  values,
  onChangeValue,
  onAdd,
  onRemove,
}: {
  field: SubmissionField;
  values: string[];
  onChangeValue: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const FieldIcon = FIELD_TYPE_ICONS[field.type];

  return (
    <div className="space-y-2">
      {values.map((val, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11 flex-1">
            <FieldIcon className="h-5 w-5 shrink-0 text-gray-400" />
            <input
              type="url"
              value={val}
              onChange={(e) => onChangeValue(i, e.target.value)}
              placeholder={field.placeholder || `Link ${i + 1}`}
              className="flex-1 border-0 p-0 h-auto text-base outline-none bg-transparent placeholder:text-[rgba(0,0,0,0.35)]"
            />
          </div>
          {values.length > 1 && (
            <button
              onClick={() => onRemove(i)}
              className="shrink-0 rounded-lg p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 text-sm text-[#4b89ef] hover:text-[#3d75d9] font-medium transition-colors py-1"
      >
        <Plus className="h-4 w-4" />
        Add another link
      </button>
      {field.helperText && (
        <p className="text-base text-[#7f7f7f]">{field.helperText}</p>
      )}
    </div>
  );
}

// ── Multi-file dropzone ───────────────────────────────────────────────

function MultiFileField({
  field,
  files,
  onAddFile,
  onRemoveFile,
}: {
  field: SubmissionField;
  files: { name: string; size: string }[];
  onAddFile: () => void;
  onRemoveFile: (index: number) => void;
}) {
  const maxFiles = field.maxFiles ?? 5;
  const canAdd = files.length < maxFiles;

  return (
    <div className="space-y-2">
      <button
        onClick={canAdd ? onAddFile : undefined}
        disabled={!canAdd}
        className={`w-full border-2 border-dashed rounded-xl py-6 flex flex-col items-center gap-2 transition-colors ${
          canAdd
            ? "border-gray-200 hover:border-[#4b89ef] hover:bg-blue-50/30 cursor-pointer"
            : "border-gray-100 bg-gray-50 cursor-not-allowed"
        }`}
      >
        <Upload className={`h-8 w-8 ${canAdd ? "text-gray-400" : "text-gray-300"}`} />
        <div className="text-center">
          <p className={`text-sm font-medium ${canAdd ? "text-gray-700" : "text-gray-400"}`}>
            {canAdd ? "Click to upload or drag and drop" : "Maximum files reached"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {files.length}/{maxFiles} files uploaded
          </p>
        </div>
      </button>

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-white border border-[rgba(0,0,0,0.1)] rounded-lg px-3 py-2"
            >
              <FileIcon className="h-5 w-5 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-900 flex-1 truncate">
                {file.name}
              </span>
              <span className="text-xs text-gray-400 shrink-0">
                {file.size}
              </span>
              <button
                onClick={() => onRemoveFile(i)}
                className="shrink-0 rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {field.helperText && (
        <p className="text-base text-[#7f7f7f]">{field.helperText}</p>
      )}
    </div>
  );
}
