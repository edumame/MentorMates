import { EventTicket } from "@/components/events/event-ticket";
import { EventPageLayout } from "@/components/events/event-page-layout";
import { EventPageSidebar } from "@/components/events/event-page-sidebar";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { notFound } from "next/navigation";
import { EventDetails } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TicketsPage({ params }: PageProps) {
  const { id } = await Promise.resolve(params);
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isUUID = isValidUUID(id);
  let query = supabase.from("events").select(`
    event_id,
    event_name,
    event_blurb,
    event_date,
    location,
    paid,
    event_type,
    cover_image_url,
    slug
  `);

  if (isUUID) {
    query = query.or(`slug.eq.${id},event_id.eq.${id}`);
  } else {
    query = query.eq("slug", id);
  }

  const { data: eventData, error: eventError } = await query.single();

  if (eventError || !eventData) {
    notFound();
  }

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

  const typedEvent = eventData as EventDetails & { cover_image_url?: string };
  return (
    <EventPageLayout
      eventName={typedEvent.event_name}
      eventBlurb={typedEvent.event_blurb || ""}
      eventDate={typedEvent.event_date}
      location={typedEvent.location}
      coverImageUrl={typedEvent.cover_image_url}
      eventId={id}
      hasJoined={hasJoined}
      dbEventId={eventData.event_id}
      paid={typedEvent.paid}
      eventType={typedEvent.event_type}
    >
      <EventTicket eventId={eventData.event_id} />
      <EventPageSidebar eventId={id} />
    </EventPageLayout>
  );
}
