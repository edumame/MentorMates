import { createSupabaseClient } from "@/app/utils/supabase/server";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { notFound } from "next/navigation";
import { EventPageLayout } from "@/components/events/event-page-layout";
import { ParticipantsContent } from "@/components/events/participants-content";

interface Participant {
  uid: string;
  display_name: string | null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicParticipantsPage({ params }: PageProps) {
  const supabase = await createSupabaseClient();
  const { id } = await params;

  const isUUID = isValidUUID(id);

  let eventQuery = supabase.from("events").select(`
    event_id,
    event_name,
    event_blurb,
    event_date,
    location,
    cover_image_url,
    slug
  `);

  if (isUUID) {
    eventQuery = eventQuery.or(`slug.eq.${id},event_id.eq.${id}`);
  } else {
    eventQuery = eventQuery.eq("slug", id);
  }

  const { data: eventData, error: eventError } = await eventQuery.single();

  if (eventError || !eventData) {
    notFound();
  }

  // Ensure any existing session is cleared so this page is always served to guests.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      console.error("Error signing out user before loading participants page:", signOutError);
    }
  }

  const hasJoined = false;
  const participantsList: Participant[] = [];

  return (
    <EventPageLayout
      eventName={eventData.event_name}
      eventBlurb={eventData.event_blurb || ""}
      eventDate={eventData.event_date}
      location={eventData.location}
      coverImageUrl={eventData.cover_image_url}
      eventId={id}
      hasJoined={hasJoined}
      dbEventId={eventData.event_id}
      forceGuest
    >
      <ParticipantsContent
        participants={participantsList}
        canViewParticipants={hasJoined}
      />
    </EventPageLayout>
  );
}
