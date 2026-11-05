import type { SupabaseClient } from "@supabase/supabase-js";

export const EVENT_COVER_BUCKET = "event-materials";

/**
 * Uploads an event cover image to storage and returns its public URL.
 *
 * The `event-materials` insert policy only allows users who are already an
 * organizer/admin of some event, so on the create-event wizard this must run
 * AFTER the event (and the creator's organizer role) exists.
 */
export async function uploadEventCoverImage(
  client: SupabaseClient,
  file: File
): Promise<string> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
  const path = `event-covers/${Math.random().toString(36).substring(2)}.${ext}`;

  const { error } = await client.storage
    .from(EVENT_COVER_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(error.message);

  return client.storage.from(EVENT_COVER_BUCKET).getPublicUrl(path).data
    .publicUrl;
}

/**
 * Uploads a cover image for an existing event and saves its URL on the event.
 * Throws with a readable message if either step fails.
 */
export async function attachEventCoverImage(
  client: SupabaseClient,
  eventId: string,
  file: File
): Promise<string> {
  const publicUrl = await uploadEventCoverImage(client, file);

  const { error } = await client
    .from("events")
    .update({ cover_image_url: publicUrl })
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);

  return publicUrl;
}
