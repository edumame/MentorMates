"use client";

import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";

export interface NumberInputProps
  extends Omit<
    InputProps,
    "type" | "value" | "defaultValue" | "onChange" | "min" | "max"
  > {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Drop any fractional part. */
  integer?: boolean;
  /** Render a bare <input> for callers that supply all of their own styling. */
  unstyled?: boolean;
}

/**
 * Number field that keeps what the user is typing as a string, so partial
 * values ("", "0", "1" on the way to "12") are not rewritten mid-keystroke.
 * In-range values reach `onValueChange` as they are typed. Everything else
 * waits for blur: out-of-range values clamp to min/max, and an empty field
 * goes back to the last valid value.
 *
 * The parent still owns `value`: if it changes to anything other than what
 * this field last emitted (a form reset, say), the draft is dropped. Parents
 * must therefore store emitted values as given, in the same update.
 */
export function NumberInput({
  value,
  onValueChange,
  min,
  max,
  integer = false,
  unstyled = false,
  onBlur,
  ...props
}: NumberInputProps) {
  // `expected` is the `value` this text belongs to: the number just emitted,
  // or the current value when the text was not emitted.
  const [draft, setDraft] = React.useState<{
    text: string;
    expected: number;
  } | null>(null);

  if (draft !== null && draft.expected !== value) {
    setDraft(null);
  }

  const parse = (raw: string): number | null => {
    if (raw.trim() === "") return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    return integer ? Math.trunc(parsed) : parsed;
  };

  const clamp = (parsed: number) =>
    Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    const parsed = parse(text);
    if (parsed !== null && parsed === clamp(parsed)) {
      setDraft({ text, expected: parsed });
      onValueChange(parsed);
    } else {
      setDraft({ text, expected: value });
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (draft !== null) {
      const parsed = parse(draft.text);
      if (parsed !== null && clamp(parsed) !== value) {
        onValueChange(clamp(parsed));
      }
      setDraft(null);
    }
    onBlur?.(e);
  };

  const Field = unstyled ? "input" : Input;

  return (
    <Field
      {...props}
      type="number"
      min={min}
      max={max}
      value={draft?.text ?? value}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
