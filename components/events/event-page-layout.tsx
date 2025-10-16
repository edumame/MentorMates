import { ReactNode } from "react";
import { EventPageHeader } from "./event-page-header";
import { EventPageTabs } from "./event-page-tabs";
import { RoleBannerWrapper } from "./role-banner-wrapper";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";

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

  // Get user's role for the event
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRole: EventRole | null = null;

  if (user) {
    const { data: userEventRole } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("event_id", dbEventId)
      .maybeSingle();

    userRole = (userEventRole?.role as EventRole) || null;
  }

  // Fetch event role labels if available
  const { data: eventData } = await supabase
    .from("events")
    .select("event_role_labels")
    .eq("event_id", dbEventId)
    .maybeSingle();

  const eventRoleLabels = eventData?.event_role_labels || null;

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
    <PageContainer>
      <PageContent className="px-0">
        <div className="flex flex-col w-full">
          {/* Role Banner - Sticky */}
          {userRole && (
            <RoleBannerWrapper
              userRole={userRole}
              eventId={dbEventId}
              eventRoleLabels={eventRoleLabels}
            />
          )}

          {/* Page Header with Cover Image */}
          <EventPageHeader
            eventName={eventName}
            eventBlurb={eventBlurb}
            eventDate={eventDate}
            location={location}
            coverImageUrl={coverImageUrl}
            eventId={eventId}
            hasJoined={hasJoined}
            userRole={userRole}
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
      </PageContent>
    </PageContainer>
  );
}
