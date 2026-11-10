import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Event cover image rules and upload (ORG-022). Mirrors the 'event-materials'
 * bucket limits in supabase/migrations/202611080403_c_event_materials_bucket.sql.
 * Intended to be shared with the create-event wizard (app/events/new).
 */

export const EVENT_COVER_BUCKET = "event-materials";
export const EVENT_COVER_MAX_BYTES = 5 * 1024 * 1024;
/** Raster formats only: SVG can carry scripts. */
export const EVENT_COVER_MIME_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const EVENT_COVER_ACCEPT = Object.keys(EVENT_COVER_MIME_TYPES).join(",");

/** Returns a user-facing error, or null when the file is acceptable. */
export function validateCoverImage(file: Pick<File, "type" | "size">): string | null {
  if (!EVENT_COVER_MIME_TYPES[file.type]) {
    return "Cover image must be a PNG, JPEG, WebP or GIF.";
  }
  if (file.size > EVENT_COVER_MAX_BYTES) {
    return "Cover image must be 5MB or smaller.";
  }
  return null;
}

async function readHeader(file: Blob, length: number): Promise<Uint8Array> {
  const slice = file.slice(0, length);
  if (typeof slice.arrayBuffer === "function") {
    return new Uint8Array(await slice.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(slice);
  });
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

/**
 * Detects the real image type from the file's magic bytes, so an SVG/HTML
 * file renamed or labelled image/png is refused before upload.
 */
export async function sniffCoverImageType(file: Blob): Promise<string | null> {
  const bytes = await readHeader(file, 12);
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

/** Object path; the extension comes from the MIME type, never the file name. */
export function buildCoverImagePath(eventId: string, mimeType: string): string {
  return `event-covers/${eventId}/${randomId()}.${EVENT_COVER_MIME_TYPES[mimeType]}`;
}

/** Validates and uploads; returns the public URL or throws a user-facing Error. */
export async function uploadEventCoverImage(
  client: Pick<SupabaseClient, "storage">,
  eventId: string,
  file: File
): Promise<string> {
  const validationError = validateCoverImage(file);
  if (validationError) throw new Error(validationError);
  // The declared type comes from the browser/file name; check the content too.
  if ((await sniffCoverImageType(file)) !== file.type) {
    throw new Error("The file's contents don't match a PNG, JPEG, WebP or GIF image.");
  }

  const path = buildCoverImagePath(eventId, file.type);
  const { error } = await client.storage
    .from(EVENT_COVER_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message || "Upload failed");

  const { data } = client.storage.from(EVENT_COVER_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
