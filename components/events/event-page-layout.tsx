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
    <div className="bg-white border-l border-[#d8d8d8] flex flex-col min-h-screen rounded-tl-[16px]">
      <div className="flex flex-col gap-12">
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
        <div className="max-w-[1280px] w-full px-6 pb-12">
          {children}
        </div>
      </div>
    </div>
  );
}
