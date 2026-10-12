import { createClient } from "@/app/utils/supabase/client";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { canAccessRole } from "@/features/user/roles/roles";
import { EventRole } from "@/lib/types";
import { redirect } from "next/navigation";

export interface InviteAcceptanceEvent {
  event_id: string;
  event_name: string;
  event_blurb: string | null;
  slug: string | null;
}

export async function loadInviteAcceptanceEvent(
  id: string
): Promise<InviteAcceptanceEvent | null> {
  const supabase = createClient();
  const isUUID = isValidUUID(id);

  let query = supabase
    .from("events")
    .select("event_id, event_name, event_blurb, slug");

  if (isUUID) {
    query = query.or(`slug.eq.${id},event_id.eq.${id}`);
  } else {
    query = query.eq("slug", id);
  }

  const { data: eventData, error } = await query.single();
  if (error || !eventData) {
    return null;
  }

  return eventData;
}

export async function redirectIfInviteAlreadyAccepted(
  eventId: string,
  eventSlug: string | null,
  targetRole: EventRole
) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return;

  const { data: existingRole } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .eq("event_id", eventId)
    .maybeSingle();

  const currentRole = existingRole?.role as EventRole | undefined;
  if (currentRole && canAccessRole(currentRole, targetRole)) {
    redirect(`/events/${eventSlug || eventId}/overview`);
  }
}
