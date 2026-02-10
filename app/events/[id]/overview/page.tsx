import React from "react";
import { notFound } from "next/navigation";
import { EventDetails, EventTrack, EventRole, Lesson } from "@/lib/types";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { isValidUUID } from "@/app/utils/supabase/queries";
import {
  getVisibleEventResources,
  normalizeEventResources,
} from "@/lib/utils/event-resources";
import { EventPageLayout } from "@/components/events/event-page-layout";
import { EventPageContent } from "@/components/events/event-page-content";
import { EventPageSidebar } from "@/components/events/event-page-sidebar";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventOverviewPage({ params }: PageProps) {
  const { id } = await Promise.resolve(params);
  const supabase = await createSupabaseClient();

  const isUUID = isValidUUID(id);

  let query = supabase.from("events").select(`
    event_id,
    event_name,
    event_description,
    event_blurb,
    event_date,
    location,
    rules,
    event_schedule,
    event_prizes,
    event_resources,
    paywall_content,
    participant_capacity,
    cover_image_url,
    slug,
    paid,
    event_type
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

  const { data: tracksData } = await supabase
    .from("event_tracks")
    .select(
      `
      *,
      prizes (
        prize_amount,
        prize_description
      )
    `
    )
    .eq("event_id", eventData.event_id);

  const typedEvent = eventData as EventDetails & { cover_image_url?: string };
  const normalizedResources = normalizeEventResources(typedEvent.event_resources);
  // Fetch lessons from new event_lessons table
  const { data: lessonsData } = await supabase
    .from("event_lessons")
    .select("title,cover_image_url,url,description,duration_minutes")
    .eq("event_id", eventData.event_id);
  (typedEvent as EventDetails & { event_lessons?: Lesson[] }).event_lessons = (lessonsData || []) as Lesson[];
  const tracks = (tracksData || []) as EventTrack[];

  // Check if user has joined and get their role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasJoined = false;
  let userRole: EventRole | null = null;

  if (user) {
    const { data: userEventRole } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("event_id", eventData.event_id)
      .maybeSingle();

    hasJoined = !!userEventRole;
    userRole = (userEventRole?.role as EventRole) || null;
  }

  const visibleResources = getVisibleEventResources(
    normalizedResources,
    hasJoined
  );
  const eventForRender: EventDetails & { cover_image_url?: string } = {
    ...typedEvent,
    event_resources: visibleResources,
  };

  return (
    <EventPageLayout
      eventName={eventForRender.event_name}
      eventBlurb={eventForRender.event_blurb || ""}
      eventDate={eventForRender.event_date}
      location={eventForRender.location}
      coverImageUrl={eventForRender.cover_image_url}
      eventId={id}
      hasJoined={hasJoined}
      dbEventId={eventData.event_id}
      paid={eventForRender.paid}
      eventType={eventForRender.event_type}
    >
      {/* Main Content */}
      <EventPageContent
        event={eventForRender}
        tracks={tracks}
        hasJoined={hasJoined}
        userRole={userRole}
      />

      {/* Sidebar */}
      <EventPageSidebar
        eventResources={visibleResources}
        eventId={eventData.event_id}
        eventSlug={eventForRender.slug}
      />
    </EventPageLayout>
  );
}
