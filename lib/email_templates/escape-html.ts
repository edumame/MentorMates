/** Escape a value for interpolation into email HTML (text or attribute). */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

/** Subjects are plain text; collapse control characters/newlines. */
export function plainTextSubject(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
}

/**
 * Prepare a URL for an href/attribute or visible text: only http(s) URLs are
 * kept (anything else becomes "#"), and characters that could leave the
 * attribute or open a tag are escaped. "&" is left as-is so query strings stay
 * readable in plain-text views (it is valid inside attribute values).
 */
export function escapeUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "#";
  } catch {
    return "#";
  }
  return value.replace(/["'<>]/g, (character) => ({
    '"': "%22", "'": "%27", "<": "%3C", ">": "%3E",
  })[character]!);
}
