import { createSupabaseClient } from "@/app/utils/supabase/server";
import { notFound } from "next/navigation";
import { EventPageLayout } from "@/components/events/event-page-layout";
import { FeedContent } from "@/components/events/feed-content";

import { resolveEventRouteId } from "@/lib/events/resolve-event-route";
interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function FeedPage({ params, searchParams }: PageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const currentPage = parseInt(resolvedSearchParams.page || "1");

  const supabase = await createSupabaseClient();

  let query = supabase.from("events").select(`
    event_id,
    event_name,
    event_blurb,
    event_date,
    location,
    cover_image_url,
    slug
  `);

  // ORG-014: one shared rule resolves the param (event_id before slug).
  const routeEventId = await resolveEventRouteId(supabase, id);
  if (!routeEventId) notFound();
  query = query.eq("event_id", routeEventId);

  const { data: eventData, error: eventError } = await query.single();

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
    >
      <FeedContent
        eventId={eventData.event_id}
        slug={eventData.slug || id}
        currentPage={currentPage}
      />
    </EventPageLayout>
  );
}
