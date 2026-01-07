"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/hooks/use-toast";
import { Archive, Trash2, ArrowUpRight } from "lucide-react";
import {
  ApprovalStatus,
  EventDetails,
  EventScoringConfig,
  EventTrack,
  EventVisibility,
  ScoringCriterion,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";

// Import existing tab components
import { ParticipantsTab } from "@/features/user/dashboards/dashboard/organizer/participants";
import { AccessTab } from "@/features/user/dashboards/dashboard/organizer/access";
import { EventTracksContainer } from "@/features/user/dashboards/dashboard/organizer/tracks";
import { AssignTab } from "@/features/user/dashboards/dashboard/organizer/assign";
import { SubmissionsTab } from "@/features/user/dashboards/dashboard/organizer/submissions";
import { ScoresTab } from "@/features/user/dashboards/dashboard/organizer/scores";
import { PricingTab } from "@/features/user/dashboards/dashboard/organizer/pricing/PricingTab";
import EmailDashboard from "@/features/user/dashboards/dashboard/organizer/notifications/EmailDashboard";
import { EmailTab } from "@/features/user/dashboards/dashboard/organizer/email";
import { ProjectImport } from "@/features/user/dashboards/dashboard/organizer/import/ProjectImportButton";
import { SessionsTab } from "@/features/user/dashboards/dashboard/organizer/sessions/SessionsTab";

// Import sub-tab components for Overview
import { BasicInfoTab } from "@/features/user/dashboards/dashboard/organizer/details/BasicInfoTab";
import { ContentTab } from "@/features/user/dashboards/dashboard/organizer/details/ContentTab";
import { ScheduleTab } from "@/features/user/dashboards/dashboard/organizer/details/ScheduleTab";
import { ResourcesTab } from "@/features/user/dashboards/dashboard/organizer/details/ResourcesTab";
import { RulesTab } from "@/features/user/dashboards/dashboard/organizer/details/RulesTab";
import { FAQTab } from "@/features/user/dashboards/dashboard/organizer/details/FAQTab";

import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/events/event-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface OrganizerEditOverviewProps {
  eventId: string;
}

export function OrganizerEditOverview({ eventId }: OrganizerEditOverviewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [scoringConfig, setScoringConfig] = useState<EventScoringConfig | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Use URL as single source of truth for tab state
  const activeTab = searchParams.get("tab") || "overview";
  const activeSubTab = searchParams.get("subtab") || "basics";

  const [participantCount, setParticipantCount] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);

  // Main tabs matching Figma design
  const mainTabs = [
    { value: "overview", label: "Overview" },
    { value: "participants", label: "Participants", badge: participantCount },
    { value: "access", label: "Access" },
    { value: "tracks", label: "Tracks" },
    { value: "assign", label: "Assign" },
    { value: "project-submission", label: "Project Submission" },
    { value: "live-scores", label: "Live Scores" },
    { value: "ticketing", label: "Ticketing" },
    { value: "notify", label: "Notify" },
    { value: "sessions", label: "Sessions" },
  ];

  // Sub-tabs under Overview matching Figma design
  const overviewSubTabs = [
    { value: "basics", label: "Basics" },
    { value: "content", label: "Content" },
    { value: "schedule", label: "Schedule" },
    { value: "resources", label: "Resources" },
    { value: "rules", label: "Rules" },
    { value: "faqs", label: "FAQs" },
    { value: "gallery", label: "Gallery" },
  ];

  // Update URL when tabs change with optimistic UI
  const setActiveTab = (tab: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      params.set("tab", tab);
      // Reset subtab to basics when changing main tabs
      if (tab === "overview") {
        params.set("subtab", "basics");
      } else {
        params.delete("subtab");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const setActiveSubTab = (subtab: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      params.set("subtab", subtab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  useEffect(() => {
    fetchEvent();
    fetchParticipantCount();
    checkAdminStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const checkAdminStatus = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data: adminData } = await supabase.rpc("is_admin_user", {
        user_id: session.user.id,
      });
      setIsAdmin(adminData || false);
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const fetchParticipantCount = async () => {
    try {
      const { count } = await supabase
        .from("user_event_roles")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("role", "participant");

      setParticipantCount(count || 0);
    } catch (error) {
      console.error("Error fetching participant count:", error);
    }
  };

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select(
          `
          *,
          event_tracks (
            track_id,
            name,
            description,
            label,
            scoring_criteria,
            prizes (
              id,
              prize_amount,
              prize_description
            )
          )
        `
        )
        .eq("event_id", eventId)
        .single();

      if (error) throw error;

      setEvent(data as EventDetails);

      // Map event tracks to scoring_config structure
      if (data && data.event_tracks) {
        const tracksConfig: Record<
          string,
          {
            name: string;
            criteria: Array<{
              id: string;
              name: string;
              description: string;
              weight: number;
              min: number;
              max: number;
            }>;
          }
        > = {};
        data.event_tracks.forEach((track: EventTrack) => {
          if (track.track_id && track.scoring_criteria) {
            tracksConfig[track.track_id] = {
              name: track.name,
              criteria: track.scoring_criteria.criteria.map(
                (criterion: ScoringCriterion) => ({
                  id: criterion.id,
                  name: criterion.name,
                  description: criterion.description,
                  weight: criterion.weight || 1,
                  min: criterion.min || 1,
                  max: criterion.max || 10,
                  type: criterion.type || "numeric",
                  options: criterion.options || [],
                })
              ),
            };
          }
        });

        const scoreConfig = {
          tracks: tracksConfig,
          defaultMin: 1,
          defaultMax: 10,
          defaultWeight: 1,
        };
        setScoringConfig(scoreConfig);
      }
    } catch (error) {
      console.error("Error fetching event:", error);
      toast({
        title: "Error",
        description: "Failed to load event details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderPreviewCard = () => {
    if (!event) return null;

    const previewUrl = `/events/${event.slug || event.event_id}/overview?view=participant`;

    return (
      <div className="flex-shrink-0 space-y-3 w-full lg:w-[335px] overflow-x-hidden order-first lg:order-last">
        <div className="w-full lg:w-[335px]">
          <EventCard event={event} />
        </div>

        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-[#7f7f7f] hover:text-[#4b89ef] transition-colors cursor-pointer mt-3"
        >
          <span className="text-[16px]">Preview event page</span>
          <ArrowUpRight className="w-[18px] h-[18px]" />
        </a>
      </div>
    );
  };

  const handleDelete = async () => {
    if (!event) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/events/${event.event_id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to delete event");
      }
      toast({ title: "Event deleted" });
      // Navigate back to events list
      router.push("/events");
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!event) return;

    try {
      setArchiving(true);
      const action =
        event.visibility === EventVisibility.Archived ? "unarchive" : "archive";

      const res = await fetch(`/api/events/${event.event_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to ${action} event`);
      }

      const result = await res.json();

      // Update local state
      setEvent({ ...event, visibility: result.newVisibility });

      toast({
        title: "Success",
        description: `Event ${action}d successfully`,
      });

      // Refresh the page to update any cached data
      router.refresh();
    } catch (error) {
      console.error(
        `Error ${event.visibility === EventVisibility.Archived ? "unarchiving" : "archiving"} event:`,
        error
      );
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setArchiving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 h-screen">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center py-12 h-screen">
        <p className="text-lg text-red-600">Event not found</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-hidden">
      <div className="w-full flex flex-col lg:min-h-[calc(100vh-88px)] lg:h-[calc(100vh-88px)] lg:overflow-hidden lg:rounded-tl-2xl lg:border-t lg:border-l lg:border-[#D8D8D8] bg-white">
        <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 w-full flex flex-col pb-20 lg:pb-4 lg:flex-1 lg:min-h-0 overflow-x-hidden">
          {/* Header with title and action buttons */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 flex-shrink-0">
            <div className="flex items-center gap-2">
              <h1
                className="text-xl sm:text-2xl font-semibold text-gray-900"
                style={{ fontFamily: "Geist, sans-serif" }}
              >
                Manage Event
              </h1>
              {event.visibility && (
                <Badge
                  className={`${
                    event.visibility === EventVisibility.Draft
                      ? "bg-orange-500/20 text-black border-none text-xs sm:text-sm"
                      : event.visibility === EventVisibility.Public
                        ? "bg-green-500/20 text-black border-none text-xs sm:text-sm"
                        : "bg-gray-500/20 text-black border-none text-xs sm:text-sm"
                  }`}
                >
                  {event.visibility.toUpperCase()}
                </Badge>
              )}

              <Badge
                variant="secondary"
                className={`${
                  event.approval_status === ApprovalStatus.Submitted
                    ? "bg-blue-500/20 text-black border-none text-xs sm:text-sm"
                    : event.approval_status === ApprovalStatus.Approved
                      ? "bg-green-500/20 text-black border-none text-xs sm:text-sm"
                      : event.approval_status === ApprovalStatus.Rejected
                        ? "bg-red-500/20 text-black border-none text-xs sm:text-sm"
                        : "bg-gray-500/20 text-black border-none text-xs sm:text-sm"
                }`}
              >
                {event.approval_status?.toUpperCase() || "NOT SUBMITTED"}
              </Badge>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              {/* Archive Event Dialog */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="defaultGray"
                    className="gap-[6px] px-4 sm:px-6 py-[10px] text-[14px] sm:text-[16px] font-medium flex-1 sm:flex-none"
                    disabled={
                      archiving || event.visibility === EventVisibility.Archived
                    }
                  >
                    <Archive className="w-5 h-5 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">
                      {archiving ? "Archiving..." : "Archive"}
                    </span>
                    <span className="sm:hidden">
                      {archiving ? "..." : "Archive"}
                    </span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {event.visibility === EventVisibility.Archived
                        ? "Unarchive this event?"
                        : "Archive this event?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {event.visibility === EventVisibility.Archived
                        ? "This will make the event editable again and change its visibility to private. You can change the visibility afterwards if needed."
                        : "Archived events are hidden from non-organizers and the public, and cannot be edited by organizers. You can unarchive it later if needed."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleArchiveToggle}>
                      {event.visibility === EventVisibility.Archived
                        ? "Confirm Unarchive"
                        : "Confirm Archive"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Delete Event Dialog */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={deleting}
                    className="gap-[6px] px-4 sm:px-6 py-[10px] text-[14px] sm:text-[16px] font-medium flex-1 sm:flex-none"
                  >
                    <Trash2 className="w-5 h-5 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">Delete</span>
                    <span className="sm:hidden">Delete</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove the event and related data
                      (tickets, payments, tracks, feedback). This cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={handleDelete}
                    >
                      Confirm Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Main Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value)}
            className="flex flex-col lg:flex-1 lg:min-h-0"
          >
            <div
              className="w-full overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 mb-6 flex-shrink-0"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <TabsList className="flex h-auto gap-4 sm:gap-6 items-center border-b border-[#d2d7e7] p-0 justify-start bg-transparent rounded-none flex-nowrap min-w-max">
                {mainTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="px-0 py-2 text-[16px] font-normal text-black border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0 whitespace-nowrap flex-shrink-0 flex items-center gap-2"
                  >
                    {tab.label}
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="bg-white border border-[rgba(0,0,0,0.15)] px-2 py-0 rounded-full text-[12px] font-normal">
                        {tab.badge}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Content Area - Scrollable on Desktop */}
            <div
              className="flex flex-col lg:flex-row gap-6 lg:gap-12 items-start w-full lg:flex-1 lg:min-h-0 lg:overflow-auto no-scrollbar"
              style={{
                opacity: isPending ? 0.4 : 1,
                transition: "opacity 150ms",
              }}
            >
              {/* Left Column - Form Content */}
              <div className="w-full lg:flex-[2] lg:min-w-0 flex flex-col items-start">
                {/* Overview Tab Content */}
                <TabsContent value="overview" className="mt-0 w-full">
                  <Tabs
                    value={activeSubTab}
                    onValueChange={(value) => setActiveSubTab(value)}
                  >
                    <div
                      className="w-screen -mx-4 sm:-mx-6 lg:w-full lg:mx-0 overflow-x-auto overflow-y-visible px-4 sm:px-6 lg:px-0 mb-6"
                      style={{
                        WebkitOverflowScrolling: "touch",
                        scrollbarWidth: "thin",
                        msOverflowStyle: "-ms-autohiding-scrollbar",
                      }}
                    >
                      <TabsList className="inline-flex h-auto gap-2 bg-transparent p-0 justify-start pb-1 items-center flex-nowrap">
                        {overviewSubTabs.map((subTab) => (
                          <TabsTrigger
                            key={subTab.value}
                            value={subTab.value}
                            className="px-4 py-2.5 rounded-[100px] text-sm leading-normal font-normal text-black border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[rgba(0,0,0,0.15)] flex-shrink-0"
                            style={{ fontFamily: "Inter, sans-serif" }}
                          >
                            {subTab.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>

                    <div className="w-full min-w-0">
                      <TabsContent value="basics" className="mt-0 ml-2">
                        {event && (
                          <BasicInfoTab
                            event={event}
                            setEvent={setEvent}
                            saving={saving}
                            setSaving={setSaving}
                            toast={toast}
                            router={router}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="content" className="mt-0 ml-2">
                        {event && (
                          <ContentTab
                            event={event}
                            setEvent={setEvent}
                            isArchived={event.visibility === "archived"}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="schedule" className="mt-0 ml-2">
                        {event && (
                          <ScheduleTab
                            event={event}
                            setEvent={setEvent}
                            saving={saving}
                            setSaving={setSaving}
                            toast={toast}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="resources" className="mt-0 ml-2">
                        {event && (
                          <ResourcesTab
                            event={event}
                            setEvent={setEvent}
                            saving={saving}
                            setSaving={setSaving}
                            toast={toast}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="rules" className="mt-0 ml-2">
                        {event && (
                          <RulesTab
                            event={event}
                            setEvent={setEvent}
                            saving={saving}
                            setSaving={setSaving}
                            toast={toast}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="faqs" className="mt-0 ml-2">
                        {event && (
                          <FAQTab
                            event={event}
                            setEvent={setEvent}
                            saving={saving}
                            setSaving={setSaving}
                            toast={toast}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="gallery" className="mt-0 ml-2">
                        <div className="text-center py-12">
                          <p className="text-lg text-gray-500">
                            Gallery section coming soon
                          </p>
                        </div>
                      </TabsContent>
                    </div>
                  </Tabs>
                </TabsContent>

                {/* Other Main Tabs */}
                <TabsContent value="participants" className="mt-0 w-full">
                  <ParticipantsTab eventId={eventId} />
                </TabsContent>

                <TabsContent value="access" className="mt-0 w-full">
                  {event && (
                    <AccessTab
                      eventId={eventId}
                      event={event}
                      setEvent={setEvent}
                      saving={saving}
                      setSaving={setSaving}
                    />
                  )}
                </TabsContent>

                <TabsContent value="tracks" className="mt-0 w-full">
                  {event && (
                    <EventTracksContainer
                      eventId={eventId}
                      event={event}
                      setEvent={setEvent}
                      scoringConfig={scoringConfig}
                      setScoringConfig={setScoringConfig}
                      saving={saving}
                      setSaving={setSaving}
                      toast={toast}
                    />
                  )}
                </TabsContent>

                <TabsContent value="assign" className="mt-0 w-full">
                  <AssignTab eventId={eventId} />
                </TabsContent>

                <TabsContent value="project-submission" className="mt-0 w-full">
                  <div className="space-y-6">
                    <SubmissionsTab eventId={eventId} />
                    <div className="border-t border-[rgba(0,0,0,0.15)] pt-6">
                      <h2 className="text-xl font-semibold mb-4 text-black">
                        Import Projects
                      </h2>
                      <ProjectImport eventId={eventId} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="live-scores" className="mt-0 w-full">
                  <ScoresTab
                    eventId={eventId}
                    scoringConfig={
                      scoringConfig || {
                        tracks: {},
                        defaultMin: 1,
                        defaultMax: 10,
                        defaultWeight: 1,
                      }
                    }
                  />
                </TabsContent>

                <TabsContent value="ticketing" className="mt-0 w-full">
                  {isAdmin ? (
                    <PricingTab
                      event={event!}
                      setEvent={setEvent}
                      saving={saving}
                      setSaving={setSaving}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-lg text-gray-500">
                        Only admins can access ticketing settings
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="notify" className="mt-0 w-full">
                  {event && (
                    <div className="space-y-6">
                      <EmailDashboard
                        eventId={eventId}
                        eventName={event.event_name}
                      />
                      <div className="border-t border-[rgba(0,0,0,0.15)] pt-6">
                        <h2 className="text-xl font-semibold mb-4 text-black">
                          Email Project Participants
                        </h2>
                        <EmailTab eventId={eventId} />
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="sessions" className="mt-0 w-full">
                  <SessionsTab eventId={eventId} event={event} setEvent={setEvent} />
                </TabsContent>
              </div>

              {/* Right Column - Preview Card */}
              {/* Only show on Overview tab to allow more space for other tabs like Participants/Tracks */}
              {activeTab === "overview" && renderPreviewCard()}
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
