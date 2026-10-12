import { createSupabaseClient } from "@/app/utils/supabase/server";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { notFound } from "next/navigation";
import { EventPageLayout } from "@/components/events/event-page-layout";
import { TeamFormationPanel } from "@/features/teams/components/TeamFormationPanel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventTeamPage({ params }: PageProps) {
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
    slug,
    paid,
    team_formation_enabled
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

  // Check if the user has joined this event.
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

  const teamFormationEnabled = Boolean(eventData.team_formation_enabled);

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
      paid={eventData.paid}
    >
      {!hasJoined ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <p className="text-[16px] leading-[1.5] text-gray-500">
            Join this event to form a team.
          </p>
        </div>
      ) : !teamFormationEnabled ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <p className="text-[16px] leading-[1.5] text-gray-500">
            Team formation isn&apos;t enabled for this event yet.
          </p>
        </div>
      ) : (
        <TeamFormationPanel eventId={eventData.event_id} />
      )}
    </EventPageLayout>
  );
}
