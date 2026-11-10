import { z } from "zod";

/** Only plain http(s) links without embedded credentials (no javascript:, data:, ...). */
export function isSafeWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

/** Zod string schema for a profile link, shared by the profile form and API (MENT-011). */
export function webUrlSchema(message = "Invalid URL") {
  return z
    .string()
    .url(message)
    .refine(isSafeWebUrl, "Links must start with http:// or https://");
}
