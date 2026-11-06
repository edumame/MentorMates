import "server-only";

import { createSupabaseClient } from "@/app/utils/supabase/server";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { verifyEventRoleInviteToken, type InvitableEventRole } from "@/lib/utils/jwt";
import { canAccessRole } from "@/features/user/roles/roles";
import { EventRole } from "@/lib/types";
import { redirect } from "next/navigation";

export interface InviteAcceptanceEvent {
  event_id: string;
  event_name: string;
  event_blurb: string | null;
  slug: string | null;
  invitedEmail: string;
}

export async function loadInviteAcceptanceEvent(
  id: string,
  { token, role }: { token?: string; role: InvitableEventRole }
): Promise<InviteAcceptanceEvent | null> {
  const invite = typeof token === "string" && token
    ? await verifyEventRoleInviteToken(token)
    : null;
  if (!invite || invite.role !== role) return null;
  if (isValidUUID(id) && id !== invite.eventId) return null;

  // Invitations must work before membership exists. Only a verified invitation
  // permits this limited read; ordinary event pages retain their RLS checks.
  // The signed ID is authoritative so emailed slugs survive event renames.
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select("event_id, event_name, event_blurb, slug")
    .eq("event_id", invite.eventId)
    .maybeSingle();

  if (error) {
    // A database outage is not an invalid invitation. Let the error boundary
    // offer a retry, without logging the bearer token or recipient email.
    console.error("Failed to load invitation event", error.code);
    throw new Error("Unable to load invitation. Please try again.");
  }
  return data ? { ...data, invitedEmail: invite.email } : null;
}

export async function redirectIfInviteAlreadyAccepted(
  eventId: string,
  eventSlug: string | null,
  targetRole: EventRole
) {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existingRole, error } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) throw new Error("Unable to check invitation access. Please try again.");
  if (existingRole && canAccessRole(existingRole.role as EventRole, targetRole)) {
    redirect(`/events/${eventSlug || eventId}/overview`);
  }
}
