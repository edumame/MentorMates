"use client";

import { ReactNode } from "react";
import { EventRegistrationWrapper } from "@/components/event-registration-wrapper";
import { EventHeader } from "@/components/events/event-header";
import { Footer } from "@/components/layout/Footer";
import { useLayoutConfig } from "@/components/layout/LayoutConfigProvider";
import { EventVisibility } from "@/lib/types";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();
  const isRedesignedPage = pathname?.includes('/overview') || pathname?.includes('/gallery') || pathname?.includes('/feed') || pathname?.includes('/schedule') || pathname?.includes('/participants') || pathname?.includes('/faqs');

  if (!showEventHeader && !showEventWrapper && !showFooter) {
    // Clean layout - no event components (redesigned pages handle their own layout)
    return <>{children}</>;
  }

  // Standard event layout with configurable components
  const content = (
    <main className="flex-1 overflow-auto">
      {isRedesignedPage ? (
        // Redesigned pages: no wrapper, full width
        <>
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
        </>
      ) : (
        // Old pages: constrained width
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 w-full">
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
        </div>
      )}
    </main>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {showEventWrapper ? (
        <EventRegistrationWrapper eventId={event.event_id}>
          {content}
        </EventRegistrationWrapper>
      ) : (
        content
      )}
      {showFooter && <Footer />}
    </div>
  );
}
