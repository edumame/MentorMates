import { ReactNode } from "react";
import { EventPageHeader } from "./event-page-header";
import { EventPageTabs } from "./event-page-tabs";
import { EventPageClientWrapper } from "./event-page-client-wrapper";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";
import { ActiveRoleProvider } from "./ActiveRoleContext";
import { EVENT_PAGE_SHELL_CLASS } from "./event-page-shell";

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
  paid?: boolean;
  eventType?: string[];
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
  paid,
  eventType,
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

  // Fetch event role labels and feature flags if available
  const { data: eventData } = await supabase
    .from("events")
    .select("role_labels, team_formation_enabled")
    .eq("event_id", dbEventId)
    .maybeSingle();

  const eventRoleLabels =
    (eventData?.role_labels as Record<string, string> | null) || null;

  // Team tab is opt-in per event and only relevant to joined members.
  const showTeamTab = Boolean(eventData?.team_formation_enabled) && hasJoined;

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
    .eq("event_id", dbEventId)
    .eq("submitted", true);

  return (
    <ActiveRoleProvider initialRole={userRole}>
      {/* 仅做 flex 链，视觉上的“右侧区域”由 SidebarLayout 提供（100dvh + 左边框 + 左上圆角） */}
      <div className="flex flex-col w-full flex-1 min-h-0 min-w-0" style={{ maxWidth: "100vw" }}>
        {userRole ? (
          <EventPageClientWrapper
            userRole={userRole}
            eventId={dbEventId}
            eventRoleLabels={eventRoleLabels}
            eventName={eventName}
            eventBlurb={eventBlurb}
            eventDate={eventDate}
            location={location}
            coverImageUrl={coverImageUrl}
            displayEventId={eventId}
            hasJoined={hasJoined}
            paid={paid || false}
            eventType={eventType?.length ? eventType : ["Hackathon"]}
            tabsAndContent={
              <>
                {/* Tabs Navigation */}
                <EventPageTabs
                  eventId={eventId}
                  participantCount={participantCount || 0}
                  projectCount={projectCount || 0}
                  showTicketsTab={(paid && hasJoined) || false}
                  showParticipantsTab={hasJoined}
                  showTeamTab={showTeamTab}
                />

                {/* Main Content */}
                <div className="w-full">
                  <div
                    className={`flex flex-col items-start gap-6 py-6 md:flex-row ${EVENT_PAGE_SHELL_CLASS}`}
                  >
                    {children}
                  </div>
                </div>
              </>
            }
          />
        ) : (
          <>
            {/* Page Header with Cover Image - No role */}
            <EventPageHeader
              eventName={eventName}
              eventBlurb={eventBlurb}
              eventDate={eventDate}
              location={location}
              coverImageUrl={coverImageUrl}
              eventId={dbEventId}
              hasJoined={hasJoined}
              userRole={null}
              activeRole={null}
              paid={paid || false}
              eventType={eventType?.length ? eventType : ["Hackathon"]}
              containerClassName={EVENT_PAGE_SHELL_CLASS}
            />

            {/* Tabs Navigation */}
            <EventPageTabs
              eventId={eventId}
              participantCount={participantCount || 0}
              projectCount={projectCount || 0}
              showTicketsTab={(paid && hasJoined) || false}
              showParticipantsTab={hasJoined}
              showTeamTab={showTeamTab}
            />

            {/* Main Content */}
            <div className="w-full">
              <div
                className={`flex flex-wrap items-start gap-6 py-6 sm:flex-nowrap ${EVENT_PAGE_SHELL_CLASS}`}
              >
                {children}
              </div>
            </div>
          </>
        )}
      </div>
    </ActiveRoleProvider>
  );
}
