/** Raster types accepted by the profile-images bucket (migration 202611080504). */
export const AVATAR_MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Storage path for a new avatar, or an error message. The extension comes
 * from the file's MIME type (not its user-supplied name) and the prefix is the
 * caller's own auth uid, which the bucket policies require.
 */
export function avatarObjectPath(
  authUserId: string,
  file: { type: string; size: number },
  now = Date.now()
): { path: string } | { error: string } {
  const extension = AVATAR_MIME_EXTENSIONS[file.type];
  if (!extension) return { error: "Please choose a PNG, JPEG, WebP or GIF image" };
  if (file.size > AVATAR_MAX_BYTES) return { error: "Please select an image under 5MB" };
  return { path: `avatars/${authUserId}-${now}.${extension}` };
}
