import { createSupabaseClient } from "@/app/utils/supabase/server";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { notFound } from "next/navigation";
import { EventPageLayout } from "@/components/events/event-page-layout";
import { GalleryContent } from "@/components/events/gallery-content";
import { EventRole } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function GalleryPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = await createSupabaseClient();
  const currentRole = (resolvedSearchParams.view as EventRole | null) || null;

  const isUUID = isValidUUID(id);

  let query = supabase.from("events").select(`
    event_id,
    event_name,
    event_blurb,
    event_date,
    location,
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

  // Check if user has joined
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasJoined = false;
  let userRole: string | null = null;

  if (user) {
    const { data: userEventRole } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("event_id", eventData.event_id)
      .maybeSingle();

    hasJoined = !!userEventRole;
    userRole = userEventRole?.role || null;
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
      <GalleryContent
        eventId={eventData.event_id}
        slug={id}
        hasJoined={hasJoined}
        userRole={userRole}
        currentRole={(currentRole || userRole || null) as EventRole | null}
      />
    </EventPageLayout>
  );
}
