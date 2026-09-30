"use client";

import * as React from "react";
import { X } from "lucide-react";
import {
  BUG_CATEGORIES,
  BUG_PRIORITIES,
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  REPORT_TYPES,
  TYPE_LABEL,
  type BugCategory,
  type BugPriority,
  type ReportType,
} from "@/lib/bugs";

const PRIORITY_HINT: Record<BugPriority, string> = {
  low: "cosmetic or minor",
  medium: "annoying, has a workaround",
  high: "blocks a task, no workaround",
  blocking: "nobody can use this part",
};

const TYPE_PLACEHOLDER: Record<ReportType, string> = {
  bug: "I clicked Submit on my project and nothing happened.",
  feature: "It would help to see all my event submissions in one list.",
};

const MAX_FILES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

interface BugReportDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * In-app bug report / feature request card. Submits to /api/bug-reports,
 * which stores the report and emails the team.
 */
export function BugReportDialog({ open, onClose }: BugReportDialogProps) {
  const [text, setText] = React.useState("");
  const [type, setType] = React.useState<ReportType>("bug");
  const [priority, setPriority] = React.useState<BugPriority>("medium");
  const [category, setCategory] = React.useState<BugCategory>("other");
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const previews = React.useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  React.useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  React.useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const addFiles = (incoming: FileList | File[]) => {
    setError(null);
    const next = [...files];
    for (const f of Array.from(incoming)) {
      if (!ACCEPT.split(",").includes(f.type)) {
        setError("Screenshots must be PNG, JPG, WebP or GIF.");
        continue;
      }
      if (f.size > MAX_BYTES) {
        setError("Each screenshot must be under 5 MB.");
        continue;
      }
      if (next.length >= MAX_FILES) {
        setError(`Up to ${MAX_FILES} screenshots.`);
        break;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (imgs.length) {
      e.preventDefault();
      addFiles(imgs);
    }
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("type", type);
      form.set("description", text);
      form.set("priority", priority);
      form.set("category", category);
      form.set("pageUrl", window.location.href);
      form.set("userAgent", navigator.userAgent);
      files.forEach((f) => form.append("screenshot", f, f.name));
      const res = await fetch("/api/bug-reports", { method: "POST", body: form });
      const payload = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || payload.error) {
        throw new Error(payload.error ?? "Could not send the report. Please try again.");
      }
      setDone(true);
      setText("");
      setFiles([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setDone(false);
    setError(null);
    onClose();
  };

  const canSend = !busy && text.trim().length >= 10;

  return (
    <div
      role="dialog"
      aria-label={type === "bug" ? "Report a bug" : "Request a feature"}
      className="fixed bottom-20 right-4 z-50 w-[min(92vw,24rem)] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl md:bottom-24 md:right-6"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {type === "bug" ? "Report a bug" : "Request a feature"}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {type === "bug"
              ? "Goes straight to the team. Say what you did and what happened."
              : "Goes straight to the team. Say what you want and why it helps."}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {done ? (
        <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Thanks. The team has been notified and will take a look.
        </div>
      ) : (
        <>
          <div
            role="radiogroup"
            aria-label="Report type"
            className="mt-3 flex gap-1 rounded-lg bg-gray-100 p-0.5"
          >
            {REPORT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => setType(t)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                  type === t
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={onPaste}
            rows={4}
            placeholder={TYPE_PLACEHOLDER[type]}
            className="mt-3 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#4B89EF] focus:outline-none"
          />

          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block text-[11px] font-medium text-gray-500">
              Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as BugPriority)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:border-[#4B89EF] focus:outline-none"
              >
                {BUG_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
              <span className="mt-0.5 block text-[10px] font-normal text-gray-400">
                {PRIORITY_HINT[priority]}
              </span>
            </label>
            <label className="block text-[11px] font-medium text-gray-500">
              Where
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as BugCategory)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:border-[#4B89EF] focus:outline-none"
              >
                {BUG_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              multiple
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
            <div className="flex flex-wrap items-center gap-2">
              {previews.map((src, i) => (
                <div key={src} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Screenshot ${i + 1}`}
                    className="h-14 w-14 rounded-md border border-gray-200 object-cover"
                  />
                  <button
                    type="button"
                    aria-label={`Remove screenshot ${i + 1}`}
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-[10px] text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
              {files.length < MAX_FILES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-14 w-14 flex-col items-center justify-center rounded-md border border-dashed border-gray-300 text-[10px] text-gray-500 hover:border-[#4B89EF] hover:text-[#4B89EF]"
                >
                  <span className="text-base leading-none">+</span>
                  screenshot
                </button>
              )}
            </div>
            <p className="mt-1 text-[10px] text-gray-400">
              Up to {MAX_FILES} images, 5 MB each. You can also paste a screenshot into the
              text box.
            </p>
          </div>

          {error && (
            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px] text-gray-400">The page URL is attached automatically.</p>
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              className="rounded-lg bg-[#4B89EF] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#3E7EEA] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
