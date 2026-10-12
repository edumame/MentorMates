/**
 * File-related utility functions
 */

/**
 * Extracts the filename from a URL
 * @param url - The URL containing the filename
 * @returns The decoded filename without query parameters
 */
export const getFileNameFromUrl = (url: string): string => {
  const pathParts = url.split("/");
  const fileName = pathParts[pathParts.length - 1];

  try {
    return decodeURIComponent(fileName.split("?")[0]);
  } catch {
    return fileName.split("?")[0];
  }
};

/**
 * Returns a human-friendly filename from an uploaded file URL.
 * This strips timestamp prefixes added during upload paths.
 */
export const getDisplayFileNameFromUrl = (
  url: string,
  fallback = "uploaded-file"
): string => {
  const rawName = getFileNameFromUrl(url).trim();
  const withoutGeneratedPrefix = rawName
    .replace(/^upload-\d+-/, "")
    .replace(/^\d{10,}-/, "");
  return withoutGeneratedPrefix || fallback;
};

/**
 * Sanitizes a filename for safe object storage paths.
 */
export const toStorageSafeFileName = (fileName: string): string => {
  return fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
};

/**
 * Creates a storage filename with a deterministic prefix for uniqueness.
 */
export const createUploadedStorageFileName = (fileName: string): string => {
  const safeName = toStorageSafeFileName(fileName) || "file";
  return `upload-${Date.now()}-${safeName}`;
};
