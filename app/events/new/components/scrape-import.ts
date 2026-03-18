export function extractScrapedImportPayload(
  payload: unknown
): Record<string, unknown> {
  if (!payload || typeof payload !== "object") {
    throw new Error("Failed to scrape");
  }

  const record = payload as Record<string, unknown>;

  if (record.import && typeof record.import === "object") {
    return record.import as Record<string, unknown>;
  }

  if (record.success === true && record.data && typeof record.data === "object") {
    return record.data as Record<string, unknown>;
  }

  if (typeof record.error === "string" && record.error.trim()) {
    throw new Error(record.error);
  }

  throw new Error("Scrape response missing import payload");
}
