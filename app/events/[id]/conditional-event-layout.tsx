"use client";

import { ReactNode } from "react";
import { EventRegistrationWrapper } from "@/components/event-registration-wrapper";
import { EventHeader } from "@/components/events/event-header";
import { Footer } from "@/components/layout/Footer";
import { useLayoutConfig } from "@/components/layout/LayoutConfigProvider";
import { EventVisibility } from "@/lib/types";

interface ConditionalEventLayoutProps {
  children: ReactNode;
  event: {
    event_id: string;
    event_name: string;
    event_date: string | null;
    location: string | null;
    event_blurb: string | null;
    event_description: string | null;
    cover_image_url: string | null;
    slug: string | null;
    submission_time_start: string | null;
    submission_time_cutoff: string | null;
    visibility: EventVisibility;
  };
}

export function ConditionalEventLayout({
  children,
  event,
}: ConditionalEventLayoutProps) {
  const { showEventHeader, showEventWrapper, showFooter } = useLayoutConfig();

  if (!showEventHeader && !showEventWrapper && !showFooter) {
    // Clean layout - no event components (redesigned pages handle their own layout)
    return <>{children}</>;
  }

  // Standard event layout with configurable components
  const content = (
    <main className="f">
      {showEventHeader && (
        <EventHeader
          eventName={event.event_name}
          coverImageUrl={event.cover_image_url}
          eventDate={event.event_date || undefined}
          location={event.location || undefined}
          description={
            event.event_blurb || event.event_description || undefined
          }
          eventId={event.slug || event.event_id}
          submissionTimeStart={event.submission_time_start || undefined}
          submissionTimeCutoff={event.submission_time_cutoff || undefined}
          visibility={event.visibility}
        />
      )}
      {children}
    </main>
  );

  // 内容直接交给上层（如 SidebarLayout 的 main），不再包一层 flex-grow overflow-auto px-0
  return (
    <div className="flex flex-col bg-background">
      {showEventWrapper ? (
        <EventRegistrationWrapper eventId={event.event_id}>
          {content}
        </EventRegistrationWrapper>
      ) : (
        content
      )}
      <div className="pt-8">{showFooter && <Footer />}</div>
    </div>
  );
}
