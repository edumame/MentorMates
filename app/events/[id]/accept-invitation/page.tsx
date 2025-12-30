import { createSupabaseClient } from "@/app/utils/supabase/server";
import { redirect, notFound } from "next/navigation";
import { AcceptInvitationClient } from "./AcceptInvitationClient";
import { isValidUUID } from "@/app/utils/supabase/queries";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function AcceptInvitationPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token) {
    redirect(`/events/${id}?error=missing_token`);
  }

  const supabase = await createSupabaseClient();

  // Find the event (by slug or ID)
  const isUUID = isValidUUID(id);
  
  let eventQuery = supabase
    .from("events")
    .select("event_id, event_name, event_date, location, event_blurb, cover_image_url, slug");

  if (isUUID) {
    eventQuery = eventQuery.or(`slug.eq.${id},event_id.eq.${id}`);
  } else {
    eventQuery = eventQuery.eq("slug", id);
  }

  const { data: event, error: eventError } = await eventQuery.single();

  if (eventError || !event) {
    notFound();
  }

  // Find the invitation by token
  const { data: invitation, error: invitationError } = await supabase
    .from("event_invitations")
    .select("*")
    .eq("invite_token", token)
    .eq("event_id", event.event_id)
    .single();

  if (invitationError || !invitation) {
    redirect(`/events/${id}?error=invitation_not_found`);
  }

  // Check if invitation is expired
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return (
      <AcceptInvitationClient
        event={event}
        invitation={invitation}
        token={token}
        error="expired"
      />
    );
  }

  // Check if invitation was already accepted
  if (invitation.status === "accepted") {
    redirect(`/events/${id}?info=already_accepted`);
  }

  // Check if invitation is in a valid state
  const acceptableStatuses = ["sent", "approved"];
  if (!acceptableStatuses.includes(invitation.status)) {
    return (
      <AcceptInvitationClient
        event={event}
        invitation={invitation}
        token={token}
        error="invalid_status"
      />
    );
  }

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <AcceptInvitationClient
      event={event}
      invitation={invitation}
      token={token}
      isLoggedIn={!!user}
    />
  );
}

