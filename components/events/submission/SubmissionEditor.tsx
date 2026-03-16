"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Lock,
  Paperclip,
  Send,
  Sparkles,
} from "lucide-react";
import type { SubmissionField, ChatMessage } from "./types";
import {
  FIELD_TYPE_OPTIONS,
  FIELD_TYPE_ICONS,
  LOCKED_FIELD_IDS,
} from "./SubmissionHelpers";

const CHAT_STORAGE_KEY = "mentormates:chat:submission";

interface SubmissionEditorProps {
  fields: SubmissionField[];
  onChange: (fields: SubmissionField[]) => void;
}

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  text: "I can help you customize your submission form. Try things like:\n\n\u2022 \"Add a question asking about tech stack used\"\n\u2022 \"Make the video link required\"\n\u2022 \"Remove the additional materials field\"\n\u2022 \"Add a multi-select for project categories\"",
};

export function SubmissionEditor({ fields, onChange }: SubmissionEditorProps) {
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [INITIAL_MESSAGE];
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [INITIAL_MESSAGE];
  });
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatMessages));
    } catch { /* ignore */ }
  }, [chatMessages]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages]);

  const updateField = (id: string, changes: Partial<SubmissionField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...changes } : f)));
  };

  const addFieldAt = (position?: number) => {
    const newField: SubmissionField = {
      id: `field_${Date.now()}`,
      label: "",
      type: "text",
      required: false,
      placeholder: "",
    };
    const updated = [...fields];
    if (position !== undefined) {
      updated.splice(position, 0, newField);
    } else {
      updated.push(newField);
    }
    onChange(updated);
    setEditingFieldId(newField.id);
  };

  const removeField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
    if (editingFieldId === id) setEditingFieldId(null);
  };

  const handleChatSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/events/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          event: { submission_fields: fields },
          history: chatMessages,
          context: "submission",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.error || "Something went wrong." },
        ]);
        return;
      }

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.reply },
      ]);

      if (data.patch?.submission_fields && Array.isArray(data.patch.submission_fields)) {
        onChange(data.patch.submission_fields);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Network error. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, fields, onChange]);

  return (
    <div className="flex gap-6 items-start">
      {/* Left: WYSIWYG Form Editor */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.15)]">
          <div className="px-4 py-4 sm:px-8 sm:py-6">
            <div className="space-y-1 mb-6">
              <h1 className="text-[28px] font-semibold text-black tracking-[-0.06em] leading-[1.4]">
                Submission Form
              </h1>
              <p className="text-base text-[#7f7f7f]">
                Configure the fields participants will fill out when submitting their project. Click any field to edit it, or use the + buttons to add new questions.
              </p>
            </div>

            <div className="space-y-0">
              {fields.map((field, idx) => {
                const isLocked = LOCKED_FIELD_IDS.includes(field.id);
                const isEditing = editingFieldId === field.id;

                return (
                  <div key={field.id}>
                    {idx > 0 && (
                      <AddFieldDivider onClick={() => addFieldAt(idx)} />
                    )}

                    {idx > 0 &&
                      !isLocked &&
                      LOCKED_FIELD_IDS.includes(
                        fields[idx - 1]?.id ?? ""
                      ) && (
                        <div className="border-t border-dashed border-gray-200 mb-4" />
                      )}

                    <div
                      className={`group relative rounded-xl transition-all ${
                        isEditing
                          ? "ring-2 ring-[#4B89EF] bg-blue-50/30 p-4 -mx-2"
                          : "hover:bg-gray-50/80 p-2 -mx-2 cursor-pointer"
                      }`}
                      onClick={() => {
                        if (!isEditing && !isLocked) {
                          setEditingFieldId(field.id);
                        }
                      }}
                    >
                      {!isLocked && !isEditing && (
                        <div className="absolute right-2 top-2 flex items-center gap-1 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFieldId(field.id);
                            }}
                            className="rounded-lg p-1.5 bg-white border border-[rgba(0,0,0,0.15)] text-gray-400 hover:text-[#4B89EF] hover:border-[#4B89EF]/30 shadow-sm"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeField(field.id);
                            }}
                            className="rounded-lg p-1.5 bg-white border border-[rgba(0,0,0,0.15)] text-gray-400 hover:text-red-500 hover:border-red-200 shadow-sm"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}

                      {isLocked && (
                        <div className="absolute right-2 top-2 flex items-center gap-1.5 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                            <Lock className="size-3" />
                            Locked
                          </span>
                        </div>
                      )}

                      {isEditing ? (
                        <FieldEditor
                          field={field}
                          onUpdate={(changes) =>
                            updateField(field.id, changes)
                          }
                          onClose={() => setEditingFieldId(null)}
                        />
                      ) : (
                        <FieldDisplay field={field} isLocked={isLocked} />
                      )}
                    </div>
                  </div>
                );
              })}

              <AddFieldDivider
                onClick={() => addFieldAt(fields.length)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right: AI Chat Assistant */}
      <div className="w-[360px] shrink-0 hidden md:block">
        <div className="sticky top-6">
          <div className="rounded-xl border border-[rgba(0,0,0,0.15)] bg-white overflow-hidden shadow-sm flex flex-col h-[600px]">
            <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-[#4B89EF]/5 to-[#6B9FEF]/5">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#4B89EF] to-[#6B9FEF] flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-black">
                    Form Assistant
                  </p>
                  <p className="text-xs text-[#7f7f7f]">
                    AI-powered form builder
                  </p>
                </div>
              </div>
            </div>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-[#4b89ef] text-white rounded-br-sm"
                        : "bg-gray-100 text-black rounded-bl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-xl rounded-bl-sm px-3.5 py-2.5 text-sm text-gray-400">
                    <span className="inline-flex gap-1">
                      <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 px-3 py-3">
              <form
                onSubmit={handleChatSubmit}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask me to modify the form..."
                  disabled={chatLoading}
                  className="flex-1 h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none placeholder:text-gray-400 focus:border-[#4b89ef] focus:bg-white focus:ring-1 focus:ring-[#4b89ef] transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatLoading}
                  className="h-10 w-10 rounded-xl bg-[#4b89ef] text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-[#3d75d9] transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Field Display (WYSIWYG) ────────────────────────────────────────────

function FieldDisplay({
  field,
  isLocked,
}: {
  field: SubmissionField;
  isLocked: boolean;
}) {
  const FieldIcon = FIELD_TYPE_ICONS[field.type];
  const isOptional = !field.required && !isLocked;

  return (
    <div className="space-y-2">
      <label className="text-base text-black font-normal">
        {field.label}
        {isOptional && <span className="text-[#7f7f7f]"> (Optional)</span>}
      </label>

      {field.type === "textarea" ? (
        <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 min-h-[168px]">
          <p className="text-base text-[rgba(0,0,0,0.35)]">
            {field.placeholder || `Enter ${field.label.toLowerCase()}`}
          </p>
        </div>
      ) : field.type === "file" && field.multiple ? (
        <div className="space-y-2">
          <div className="border-2 border-dashed border-gray-200 rounded-xl py-4 flex flex-col items-center gap-1">
            <Paperclip className="h-6 w-6 text-gray-300" />
            <p className="text-sm text-[rgba(0,0,0,0.35)]">
              Drop files here or click to upload
            </p>
            <p className="text-xs text-gray-300">
              Up to {field.maxFiles ?? 5} files
            </p>
          </div>
        </div>
      ) : field.type === "file" ? (
        <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
          <Paperclip className="h-6 w-6 shrink-0" />
          <span className="text-base text-[rgba(0,0,0,0.35)] flex-1 truncate">
            {field.placeholder || "https://..."}
          </span>
          <span className="bg-[rgba(0,0,0,0.05)] shadow-sm rounded-xl px-3 py-1 text-xs text-black font-normal shrink-0">
            Upload
          </span>
        </div>
      ) : field.type === "select" || field.type === "multi_select" ? (
        <div className="space-y-2">
          {(field.options || ["Option 1", "Option 2"]).map((opt, i) => (
            <label key={i} className="flex items-center gap-2">
              <input
                type={field.type === "select" ? "radio" : "checkbox"}
                disabled
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-black">{opt}</span>
            </label>
          ))}
        </div>
      ) : field.type === "checkbox" ? (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          <span className="text-base text-[rgba(0,0,0,0.35)]">
            {field.placeholder || "Yes"}
          </span>
        </label>
      ) : field.type === "url" && field.multiple ? (
        <div className="space-y-1.5">
          <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
            <FieldIcon className="h-6 w-6 shrink-0" />
            <span className="text-base text-[rgba(0,0,0,0.35)]">
              {field.placeholder || "https://..."}
            </span>
          </div>
          <p className="text-xs text-[#4b89ef]">+ Add another link</p>
        </div>
      ) : (
        <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-xl px-3 py-2 flex items-center gap-3 h-11">
          <FieldIcon className="h-6 w-6 shrink-0" />
          <span className="text-base text-[rgba(0,0,0,0.35)]">
            {field.placeholder || `Enter ${field.label.toLowerCase()}`}
          </span>
        </div>
      )}

      {field.helperText && (
        <p className="text-base text-[#7f7f7f]">{field.helperText}</p>
      )}
    </div>
  );
}

// ── Inline Field Editor ───────────────────────────────────────────────

function FieldEditor({
  field,
  onUpdate,
  onClose,
}: {
  field: SubmissionField;
  onUpdate: (changes: Partial<SubmissionField>) => void;
  onClose: () => void;
}) {
  const showOptions =
    field.type === "select" || field.type === "multi_select";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#4B89EF]">
          Editing Field
        </span>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">Label</label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="e.g., What inspired your project?"
            autoFocus
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">Type</label>
          <select
            value={field.type}
            onChange={(e) =>
              onUpdate({ type: e.target.value as SubmissionField["type"] })
            }
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
          >
            {FIELD_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium text-gray-600">
            Placeholder / help text
          </label>
          <input
            type="text"
            value={field.placeholder}
            onChange={(e) => onUpdate({ placeholder: e.target.value })}
            placeholder="Hint text shown to participants"
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium text-gray-600">
            Helper text (shown below field)
          </label>
          <input
            type="text"
            value={field.helperText || ""}
            onChange={(e) =>
              onUpdate({ helperText: e.target.value || undefined })
            }
            placeholder="e.g., Markdown supported: use headings, lists..."
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
          />
        </div>

        {showOptions && (
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-gray-600">
              Options (one per line)
            </label>
            <textarea
              value={(field.options || []).join("\n")}
              onChange={(e) =>
                onUpdate({
                  options: e.target.value
                    .split("\n")
                    .filter((o) => o.trim()),
                })
              }
              placeholder={"Option 1\nOption 2\nOption 3"}
              rows={4}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none resize-y focus:border-[#4B89EF] focus:ring-1 focus:ring-[#4B89EF]"
            />
          </div>
        )}

        {(field.type === "url" || field.type === "file") && (
          <div className="sm:col-span-2 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={field.multiple ?? false}
                onChange={(e) => onUpdate({ multiple: e.target.checked })}
                className="size-4 rounded border-gray-300 text-[#4B89EF] focus:ring-blue-500"
              />
              Allow multiple entries
            </label>
            {field.multiple && field.type === "file" && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500">Max files:</label>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={field.maxFiles ?? 5}
                  onChange={(e) =>
                    onUpdate({
                      maxFiles: Math.max(
                        2,
                        parseInt(e.target.value, 10) || 5
                      ),
                    })
                  }
                  className="w-16 h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-center outline-none focus:border-[#4B89EF]"
                />
              </div>
            )}
          </div>
        )}

        <div className="sm:col-span-2 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onUpdate({ required: e.target.checked })}
              className="size-4 rounded border-gray-300 text-[#4B89EF] focus:ring-blue-500"
            />
            Required field
          </label>
          <button
            onClick={onClose}
            className="rounded-xl bg-[#4b89ef] hover:bg-[#3d75d9] text-white px-4 py-2 text-sm font-medium shadow-sm transition-colors"
          >
            Save field
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline "+" divider ─────────────────────────────────────────────────

function AddFieldDivider({ onClick }: { onClick: () => void }) {
  return (
    <div className="group relative flex items-center justify-center py-2">
      <div className="absolute inset-x-0 top-1/2 h-px bg-gray-100 group-hover:bg-[#4B89EF]/20 transition-colors" />
      <button
        onClick={onClick}
        className="relative z-10 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white h-7 w-7 text-gray-300 hover:text-[#4B89EF] hover:border-[#4B89EF]/30 hover:bg-blue-50 shadow-sm hover:shadow sm:group-hover:w-auto sm:group-hover:px-3 sm:group-hover:gap-1.5 transition-all duration-200 overflow-hidden"
      >
        <Plus className="size-3.5 shrink-0" />
        <span className="text-xs font-medium whitespace-nowrap max-w-0 sm:group-hover:max-w-[100px] overflow-hidden transition-all duration-200 opacity-0 sm:group-hover:opacity-100">
          Add question
        </span>
      </button>
    </div>
  );
}
