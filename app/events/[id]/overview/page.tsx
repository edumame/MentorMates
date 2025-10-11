import React from "react";
import { notFound } from "next/navigation";
import {
  EventDetails,
  EventTrack,
} from "@/lib/types";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { EventPageHeader } from "@/components/events/event-page-header";
import { EventPageTabs } from "@/components/events/event-page-tabs";
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
  const tracks = (tracksData || []) as EventTrack[];

  // Check if user has joined and get their role
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
    <div className="bg-white border-l border-[#d8d8d8] flex flex-col min-h-screen rounded-tl-[16px]">
      <div className="flex flex-col gap-12">
        {/* Page Header with Cover Image */}
        <EventPageHeader
          eventName={typedEvent.event_name}
          eventBlurb={typedEvent.event_blurb || ""}
          eventDate={typedEvent.event_date}
          location={typedEvent.location}
          coverImageUrl={typedEvent.cover_image_url}
          eventId={eventData.event_id}
          hasJoined={hasJoined}
        />

        {/* Tabs Navigation */}
        <EventPageTabs eventId={id} />

        {/* Main Content Area with Sidebar */}
        <div className="max-w-[1280px] w-full px-6 pb-12">
          <div className="flex gap-6">
            {/* Main Content */}
            <EventPageContent
              event={typedEvent}
              tracks={tracks}
              hasJoined={hasJoined}
            />

            {/* Sidebar */}
            <EventPageSidebar
              eventResources={typedEvent.event_resources}
              eventId={eventData.event_id}
              eventSlug={typedEvent.slug}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
