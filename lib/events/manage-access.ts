import type { SupabaseClient } from "@supabase/supabase-js";

// Works with both the caller's server client and the service client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

/**
 * Owner, event organizer or global admin. Delegates to the SQL helper
 * public.can_manage_event() (same rule as the events UPDATE RLS policy) so the
 * API, delete_event() and the archived-events SELECT policy agree.
 * Fails closed: a lookup error counts as "not allowed".
 */
export async function canManageEvent(
  supabase: AnyClient,
  eventId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_manage_event", {
    p_event_id: eventId,
    p_user_id: userId,
  });
  if (error) {
    console.error("Error checking event permissions:", error);
    return false;
  }
  return data === true;
}
