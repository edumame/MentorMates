import { ReactNode } from "react";
import { EventPageHeader } from "./event-page-header";
import { EventPageTabs } from "./event-page-tabs";

interface EventPageLayoutProps {
  children: ReactNode;
  eventName: string;
  eventBlurb: string;
  eventDate: string;
  location: string;
  coverImageUrl?: string;
  eventId: string;
  hasJoined: boolean;
}

export function EventPageLayout({
  children,
  eventName,
  eventBlurb,
  eventDate,
  location,
  coverImageUrl,
  eventId,
  hasJoined,
}: EventPageLayoutProps) {
  return (
    <div className="bg-white border-l border-[#d8d8d8] flex flex-col min-h-screen w-full">
      <div className="flex flex-col w-full">
        {/* Page Header with Cover Image */}
        <EventPageHeader
          eventName={eventName}
          eventBlurb={eventBlurb}
          eventDate={eventDate}
          location={location}
          coverImageUrl={coverImageUrl}
          eventId={eventId}
          hasJoined={hasJoined}
        />

        {/* Tabs Navigation */}
        <EventPageTabs eventId={eventId} />

        {/* Main Content */}
        <div className="w-full">
          <div className="flex gap-6 w-full px-6 py-12">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
