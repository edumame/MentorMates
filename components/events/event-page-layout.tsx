import { ReactNode } from "react";
import { EventPageHeader } from "./event-page-header";
import { EventPageTabs } from "./event-page-tabs";
import { createSupabaseClient } from "@/app/utils/supabase/server";

interface EventPageLayoutProps {
  children: ReactNode;
  eventName: string;
  eventBlurb: string;
  eventDate: string;
  location: string;
  coverImageUrl?: string;
  eventId: string;
  hasJoined: boolean;
  dbEventId: string; // The actual database UUID for the event
}

export async function EventPageLayout({
  children,
  eventName,
  eventBlurb,
  eventDate,
  location,
  coverImageUrl,
  eventId,
  hasJoined,
  dbEventId,
}: EventPageLayoutProps) {
  const supabase = await createSupabaseClient();

  // Fetch participant count
  const { count: participantCount } = await supabase
    .from("user_event_roles")
    .select("*", { count: "exact", head: true })
    .eq("event_id", dbEventId)
    .eq("role", "participant");

  // Fetch project count
  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("event_id", dbEventId);
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
        <EventPageTabs eventId={eventId} participantCount={participantCount || 0} projectCount={projectCount || 0} />

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
