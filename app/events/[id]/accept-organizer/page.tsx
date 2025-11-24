import { createClient } from "@/app/utils/supabase/client";
import { redirect } from "next/navigation";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { AcceptOrganizerInvite } from "./AcceptOrganizerInvite";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ email?: string }>;
}

export default async function AcceptOrganizerInvitePage({ params, searchParams }: PageProps) {
  const { id } = await Promise.resolve(params);
  const { email } = await Promise.resolve(searchParams);
  const supabase = createClient();

  const isUUID = isValidUUID(id);

  let query = supabase.from("events").select("event_id, event_name, event_blurb, slug");

  if (isUUID) {
    query = query.or(`slug.eq.${id},event_id.eq.${id}`);
  } else {
    query = query.eq("slug", id);
  }

  const { data: eventData, error } = await query.single();

  if (error || !eventData) {
    // Event not found - pass null to show error state
    return (
      <AcceptOrganizerInvite
        eventId=""
        eventName=""
        eventBlurb={null}
        eventSlug={null}
        invitedEmail={email}
        eventNotFound={true}
      />
    );
  }

  // Check if user is authenticated and already an organizer
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    const { data: existingRole } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("event_id", eventData.event_id)
      .maybeSingle();

    // If user is already an organizer, redirect to overview page
    if (existingRole?.role === 'organizer') {
      const overviewUrl = `/events/${eventData.slug || eventData.event_id}/overview`;
      redirect(overviewUrl);
    }
  }

  return (
    <AcceptOrganizerInvite
      eventId={eventData.event_id}
      eventName={eventData.event_name}
      eventBlurb={eventData.event_blurb}
      eventSlug={eventData.slug}
      invitedEmail={email}
      eventNotFound={false}
    />
  );
}
