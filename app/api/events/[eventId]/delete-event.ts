import { NextResponse } from "next/server";
import type { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Shared event deletion used by DELETE /api/events/[eventId] (organizers) and
 * DELETE /api/admin/events/[eventId] (global admins). Both go through
 * public.delete_event(), which checks permission, refuses events with
 * payments and removes all event data in one transaction
 * (supabase/migrations/202611080405_c_round2.sql).
 */

type UserClient = Pick<Awaited<ReturnType<typeof createSupabaseClient>>, "rpc">;

export const EVENT_COVER_BUCKET = "event-materials";

/** Maps delete_event() errors to responses without leaking raw DB messages. */
export function deleteEventErrorResponse(error: { code?: string; message?: string }) {
  if (error.code === "28000") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error.code === "42501") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (error.code === "P0002") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (error.message === "event_has_payments") {
    return NextResponse.json(
      {
        error:
          "This event has payment records (or a checkout in progress) and cannot be deleted. Archive it instead.",
        code: "event_has_payments",
      },
      { status: 409 }
    );
  }
  console.error("Error deleting event:", error);
  return NextResponse.json(
    { error: "Failed to delete event. Nothing was changed." },
    { status: 500 }
  );
}

/**
 * Removes the event's cover images (event-covers/<eventId>/...). Storage
 * objects cannot be deleted from SQL, so this runs after the DB delete
 * committed; failures are logged and do not fail the request.
 */
export async function removeEventCoverObjects(
  eventId: string,
  storageClient: Pick<ReturnType<typeof createSupabaseServiceClient>, "storage"> = createSupabaseServiceClient()
): Promise<void> {
  try {
    const bucket = storageClient.storage.from(EVENT_COVER_BUCKET);
    const prefix = `event-covers/${eventId}`;
    for (let page = 0; page < 50; page++) {
      const { data, error } = await bucket.list(prefix, { limit: 100 });
      if (error) throw error;
      const paths = (data ?? []).map((object) => `${prefix}/${object.name}`);
      if (paths.length === 0) return;
      const { error: removeError } = await bucket.remove(paths);
      if (removeError) throw removeError;
      if (paths.length < 100) return;
    }
  } catch (error) {
    console.error("Error removing event cover images:", error);
  }
}

/** Deletes the event; returns the HTTP response to send. */
export async function deleteEvent(client: UserClient, eventId: string) {
  const { error } = await client.rpc("delete_event", { p_event_id: eventId });
  if (error) return deleteEventErrorResponse(error);
  await removeEventCoverObjects(eventId);
  return NextResponse.json({ success: true });
}
