import React from "react";
import { notFound } from "next/navigation";
import { EventDetails } from "@/lib/types";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { EventPageLayout } from "@/components/events/event-page-layout";
import { ScheduleContent } from "@/components/events/schedule-content";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventSchedulePage({ params }: PageProps) {
  const { id } = await Promise.resolve(params);
  const supabase = await createSupabaseClient();

  const isUUID = isValidUUID(id);

  let query = supabase.from("events").select(`
    event_id,
    event_name,
    event_blurb,
    event_date,
    location,
    event_schedule,
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

  const typedEvent = eventData as EventDetails & { cover_image_url?: string };

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

  // Fetch participant count
  const { count: participantCount } = await supabase
    .from("user_event_roles")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventData.event_id)
    .eq("role", "participant");

  // Fetch project count
  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventData.event_id);

  return (
    <EventPageLayout
      eventName={typedEvent.event_name}
      eventBlurb={typedEvent.event_blurb || ""}
      eventDate={typedEvent.event_date}
      location={typedEvent.location}
      coverImageUrl={typedEvent.cover_image_url}
      eventId={id}
      hasJoined={hasJoined}
      participantCount={participantCount || 0}
      projectCount={projectCount || 0}
    >
      <ScheduleContent schedule={typedEvent.event_schedule || []} />
    </EventPageLayout>
  );
}
