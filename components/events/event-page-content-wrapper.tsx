"use client";

import { EventDetails, EventTrack, EventRole } from "@/lib/types";
import { getVisibleEventResources } from "@/lib/utils/event-resources";
import { EventPageContent } from "./event-page-content";
import { EventPageSidebar } from "./event-page-sidebar";

interface EventPageContentWrapperProps {
  event: EventDetails;
  tracks: EventTrack[];
  hasJoined: boolean;
  userRole: EventRole | null;
  activeRole: EventRole | null;
  eventSlug?: string;
}

export function EventPageContentWrapper({
  event,
  tracks,
  hasJoined,
  userRole,
  activeRole,
  eventSlug,
}: EventPageContentWrapperProps) {
  // Use activeRole for display, fallback to userRole
  const displayRole = activeRole || userRole;
  const visibleResources = getVisibleEventResources(
    event.event_resources,
    hasJoined
  );
  const eventForRender: EventDetails = {
    ...event,
    event_resources: visibleResources,
  };

  return (
    <>
      {/* Main Content */}
      <EventPageContent
        event={eventForRender}
        tracks={tracks}
        hasJoined={hasJoined}
        userRole={displayRole}
      />

      {/* Sidebar - only hide for judges; mentors see participant view */}
      {displayRole !== "judge" && (
        <EventPageSidebar
          eventResources={visibleResources}
          eventId={event.event_id}
          eventSlug={eventSlug}
        />
      )}
    </>
  );
}
