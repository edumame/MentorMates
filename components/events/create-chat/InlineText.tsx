"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A value on the draft card you can click to change in place: it reads as
 * text until clicked, then becomes a bare input in the same spot. Enter (or
 * leaving the field) keeps the change, Escape drops it. Multiline values keep
 * Enter for new lines and save with ⌘/Ctrl+Enter or on blur.
 */
export function InlineText({
  value,
  onCommit,
  label,
  placeholder,
  multiline = false,
  type = "text",
  className,
  inputClassName,
  display,
  prefix,
}: {
  value: string;
  onCommit: (next: string) => void;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  type?: "text" | "number" | "datetime-local";
  className?: string;
  inputClassName?: string;
  /** What to show when not editing; defaults to the value or the placeholder. */
  display?: React.ReactNode;
  /** Fixed text before the value while editing (e.g. the URL's host). */
  prefix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!editing) setText(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      if (type === "text" || multiline) ref.current?.select();
    }
  }, [editing, multiline, type]);

  const finish = () => {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      setText(value);
      return;
    }
    if (text !== value) onCommit(text);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelled.current = true;
      ref.current?.blur();
    } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      ref.current?.blur();
    }
  };

  if (editing) {
    const shared = {
      ref,
      "aria-label": label,
      value: text,
      placeholder,
      onBlur: finish,
      onKeyDown,
      className: cn(
        "w-full min-w-0 rounded-md border border-[rgba(0,0,0,0.15)] bg-white px-1.5 py-0.5 text-inherit outline-none focus:border-[#4B89EF]",
        inputClassName
      ),
    };
    return (
      <span className={cn("flex min-w-0 items-center gap-0.5", className)}>
        {prefix ? <span className="shrink-0 text-muted-foreground">{prefix}</span> : null}
        {multiline ? (
          <textarea {...shared} rows={4} onChange={(e) => setText(e.target.value)} />
        ) : (
          <input {...shared} type={type} onChange={(e) => setText(e.target.value)} />
        )}
      </span>
    );
  }

  const empty = !value;
  return (
    <button
      type="button"
      aria-label={`Edit ${label}`}
      title="Click to edit"
      onClick={() => setEditing(true)}
      className={cn(
        "-mx-1 block min-w-0 max-w-full rounded-md px-1 text-left transition-colors hover:bg-black/[0.04] focus-visible:bg-black/[0.04] focus-visible:outline-none",
        empty && "text-muted-foreground/70",
        className
      )}
    >
      {display ?? (empty ? placeholder : value)}
    </button>
  );
}
