import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isValidUUID } from "@/app/utils/supabase/queries";

type LookupResult<T> = { data: T | null; error: unknown };
type AnyLookupResult = { data: unknown; error: unknown };

/**
 * The one precedence rule for /events/<param> (ORG-014): a UUID param is the
 * event's own id and is matched by event_id first; only if no event has that
 * id is it treated as a slug. A UUID-shaped slug therefore cannot shadow
 * another event's UUID URL. Returns the first non-empty (or error) result.
 */
export async function lookupByEventRouteParam<R extends AnyLookupResult>(
  param: string,
  lookup: (column: "event_id" | "slug", value: string) => PromiseLike<R>
): Promise<R> {
  if (isValidUUID(param)) {
    const byId = await lookup("event_id", param);
    if (byId.error || byId.data) return byId;
  }
  return lookup("slug", param);
}

type EventsClient = Pick<SupabaseClient<Database>, "from">;

/** Resolve a route param (UUID or slug) to an event_id the caller can read, or null. */
export async function resolveEventRouteId(client: EventsClient, param: string): Promise<string | null> {
  const id = param?.trim();
  if (!id) return null;
  const { data } = await lookupByEventRouteParam(id, (column, value) =>
    client.from("events").select("event_id").eq(column, value).maybeSingle()
  );
  return data?.event_id ?? null;
}
