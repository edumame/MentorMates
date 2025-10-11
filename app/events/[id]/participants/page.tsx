import { createSupabaseClient } from "@/app/utils/supabase/server";
import { UUID } from "crypto";
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

  // Check if user has joined
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasJoined = false;

  if (user) {
    const { data: userEventRole } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("event_id", eventData.event_id)
      .maybeSingle();

    hasJoined = !!userEventRole;
  }

  const { data: participants, error } = await supabase
    .from("user_event_roles")
    .select("user_id, user_profiles!user_id(uid, display_name)")
    .eq("event_id", eventData.event_id)
    .eq("role", "participant")
    .overrideTypes<
      Array<{
        user_id: UUID;
        user_profiles: {
          uid: UUID;
          display_name: string;
        };
      }>
    >();

  if (error) {
    console.error("Error fetching participants:", error);
  }

  const participantsList: Participant[] = participants
    ? participants.map((participant) => ({
        uid: participant.user_profiles.uid,
        display_name: participant.user_profiles.display_name,
      }))
    : [];

  // Fetch project count
  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventData.event_id);

  return (
    <EventPageLayout
      eventName={eventData.event_name}
      eventBlurb={eventData.event_blurb || ""}
      eventDate={eventData.event_date}
      location={eventData.location}
      coverImageUrl={eventData.cover_image_url}
      eventId={id}
      hasJoined={hasJoined}
      participantCount={participantsList.length}
      projectCount={projectCount || 0}
    >
      <ParticipantsContent participants={participantsList} />
    </EventPageLayout>
  );
}
