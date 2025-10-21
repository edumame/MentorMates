"use client";

import { EventDetails, EventTrack, EventRole } from "@/lib/types";
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

  return (
    <>
      {/* Main Content */}
      <EventPageContent
        event={event}
        tracks={tracks}
        hasJoined={hasJoined}
        userRole={displayRole}
      />

      {/* Sidebar - only hide for judges; mentors see participant view */}
      {displayRole !== "judge" && (
        <EventPageSidebar
          eventResources={event.event_resources}
          eventId={event.event_id}
          eventSlug={eventSlug}
        />
      )}
    </>
  );
}
