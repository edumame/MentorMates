"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/lib/hooks/use-toast";
import { canAccessRole } from "@/features/user/roles/roles";
import {
  Sparkles,
  Calendar,
  FileText,
  Shield,
  FolderKanban,
  DollarSign,
  Bell,
  Mail,
} from "lucide-react";

import {
  EventDetails,
  EventRole,
  EventScoringConfig,
  EventTrack,
  ScoringCriterion,
} from "@/lib/types";

// Tab components
import { SubmissionsTab } from "./submissions";
import { ScoresTab } from "./scores";
import { ParticipantsTab } from "./participants";
import { EventTracksContainer } from "./tracks";
import { AccessTab } from "./access";
import { AssignTab } from "./assign";
import { ProjectImport } from "./import/ProjectImportButton";
import { EmailTab } from "./email";
import { PricingTab } from "./pricing/PricingTab";
import EmailDashboard from "./notifications/EmailDashboard";
import { InvitationsTab } from "./invitations";
// Overview sub-tab components
import { BasicInfoTab } from "./details/BasicInfoTab";
import { ContentTab } from "./details/ContentTab";
import { ScheduleTab } from "./details/ScheduleTab";
import { ResourcesTab } from "./details/ResourcesTab";
import { RulesTab } from "./details/RulesTab";
import { FAQTab } from "./details/FAQTab";
import { useEventArchiveStatus } from "@/lib/hooks/use-event-archive-status";
import { PageContainer, PageContent } from "@/components/layout/PageContainer";

export function OrganizerDashboard({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scoringConfig, setScoringConfig] = useState<EventScoringConfig | null>(
    null
  );
  const [activeTab, setActiveTab] = useState("overview");
  const [activeSubTab, setActiveSubTab] = useState("basics");
  const [isAdmin, setIsAdmin] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const router = useRouter();
  const { toast } = useToast();

  // Redirect from pricing tab if user is not admin
  useEffect(() => {
    if (activeTab === "pricing" && !isAdmin) {
      setActiveTab("overview");
    }
  }, [activeTab, isAdmin]);

  // Main tabs matching Figma design
  const primaryTabs = [
    { value: "overview", label: "Overview", icon: Sparkles },
    { value: "registration", label: "Registration", icon: Calendar },
    { value: "invitations", label: "Invitations", icon: Mail },
    { value: "project", label: "Project", icon: FileText },
    { value: "access", label: "Access", icon: Shield },
    { value: "tracks", label: "Tracks", icon: FolderKanban },
    { value: "pricing", label: "Pricing", icon: DollarSign },
    { value: "notify", label: "Notify", icon: Bell },
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

  useEffect(() => {
    async function fetchEvent() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        const userId = session.user.id;

        // Fetch user's role for this event and check access in app code
        const { data: roleData } = await supabase
          .from("user_event_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("event_id", eventId)
          .maybeSingle();

        if (
          !roleData ||
          !canAccessRole(roleData.role as EventRole, EventRole.Organizer)
        ) {
          toast({
            title: "Error",
            description: "You don't have permission to edit this event",
            variant: "destructive",
          });
          router.push(`/events/${eventId}/dashboard`);
          return;
        }

        // Check if user is an admin
        const { data: adminData } = await supabase.rpc("is_admin_user", {
          user_id: userId,
        });
        setIsAdmin(adminData || false);

        const { data: eventData, error } = await supabase
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

        // Fetch event_lessons separately
        const { data: lessonsData, error: lessonsError } = await supabase
          .from("event_lessons")
          .select("title,cover_image_url,url,description,duration_minutes")
          .eq("event_id", eventId);

        if (lessonsError) {
          console.error("Error fetching lessons:", lessonsError);
        }

        // Add lessons to event data
        eventData.event_lessons = lessonsData || [];
        setEvent(eventData);

        // Map event tracks to scoring_config structure if needed
        if (eventData && eventData.event_tracks) {
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

          eventData.event_tracks.forEach((track: EventTrack) => {
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
    }

    fetchEvent();
  }, [eventId, router, toast, refetchTrigger]);

  const { isArchived } = useEventArchiveStatus(event);

  // Function to trigger a refetch of event data
  const refetchEvent = () => {
    setRefetchTrigger((prev) => prev + 1);
  };

  if (loading) {
    return (
      <PageContainer>
        <PageContent className="px-4 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1064px] flex-col gap-12">
            <div className="flex min-h-[400px] items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
            </div>
          </div>
        </PageContent>
      </PageContainer>
    );
  }

  if (!event) {
    return (
      <PageContainer>
        <PageContent className="px-4 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1064px] flex-col gap-12">
            <div className="py-8 text-center">
              <p className="text-gray-600">Event not found</p>
            </div>
          </div>
        </PageContent>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageContent className="px-4 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1064px] flex-col gap-12">
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="-mx-2 mb-6 overflow-x-auto pb-2 sm:mx-0 sm:overflow-visible">
                <TabsList className="flex h-auto min-w-full gap-2 overflow-x-auto rounded-none bg-transparent p-0 sm:min-w-0 sm:flex-wrap sm:rounded-lg sm:bg-muted sm:p-1">
                  {primaryTabs.map((item) => (
                    <TabsTrigger
                      key={item.value}
                      value={item.value}
                      title={item.label}
                      className="flex-shrink-0 gap-2 px-4 py-2 text-sm font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <TabsContent value="overview" className="mt-0">
                <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
                  <TabsList className="flex h-auto gap-2 overflow-x-auto rounded-lg bg-transparent p-0 mb-6 border-b border-gray-200">
                    {overviewSubTabs.map((subTab) => (
                      <TabsTrigger
                        key={subTab.value}
                        value={subTab.value}
                        className="px-4 py-2 text-sm font-medium border-b-2 border-transparent data-[state=active]:border-[#4b89ef]"
                      >
                        {subTab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <TabsContent value="basics" className="mt-0">
                    <BasicInfoTab
                      event={event}
                      setEvent={setEvent}
                      saving={saving}
                      setSaving={setSaving}
                      toast={toast}
                      router={router}
                    />
                  </TabsContent>

                  <TabsContent value="content" className="mt-0">
                    <ContentTab
                      event={event}
                      setEvent={setEvent}
                      refetchEvent={refetchEvent}
                      isArchived={isArchived}
                    />
                  </TabsContent>

                  <TabsContent value="schedule" className="mt-0">
                    <ScheduleTab
                      event={event}
                      setEvent={setEvent}
                      saving={saving}
                      setSaving={setSaving}
                      toast={toast}
                    />
                  </TabsContent>

                  <TabsContent value="resources" className="mt-0">
                    <ResourcesTab
                      event={event}
                      setEvent={setEvent}
                      saving={saving}
                      setSaving={setSaving}
                      toast={toast}
                    />
                  </TabsContent>

                  <TabsContent value="rules" className="mt-0">
                    <RulesTab
                      event={event}
                      setEvent={setEvent}
                      saving={saving}
                      setSaving={setSaving}
                      toast={toast}
                    />
                  </TabsContent>

                  <TabsContent value="faqs" className="mt-0">
                    <FAQTab
                      event={event}
                      setEvent={setEvent}
                      saving={saving}
                      setSaving={setSaving}
                      toast={toast}
                    />
                  </TabsContent>

                  <TabsContent value="gallery" className="mt-0">
                    <div className="rounded-lg border bg-card p-6">
                      <h3 className="text-lg font-semibold mb-4">Gallery</h3>
                      <p className="text-gray-500">
                        Gallery management coming soon
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="registration" className="mt-0">
                <div className="rounded-lg border bg-card p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Registration Settings
                  </h3>
                  <p className="text-gray-500">
                    Registration configuration coming soon
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="invitations" className="mt-0">
                <div className="rounded-lg border bg-card p-6">
                  <InvitationsTab
                    eventId={eventId}
                    eventName={event.event_name}
                  />
                </div>
              </TabsContent>

              <TabsContent value="project" className="mt-0">
                <div className="rounded-lg border bg-card p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Project Settings
                  </h3>
                  <div className="space-y-4">
                    <SubmissionsTab eventId={eventId} />
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
                  </div>
                </div>
              </TabsContent>

              {isAdmin && (
                <TabsContent value="pricing" className="mt-0">
                  <PricingTab
                    event={event}
                    setEvent={setEvent}
                    saving={saving}
                    setSaving={setSaving}
                  />
                </TabsContent>
              )}

              <TabsContent value="access" className="mt-0">
                <AccessTab
                  eventId={eventId}
                  event={event}
                  setEvent={setEvent}
                  saving={saving}
                  setSaving={setSaving}
                />
              </TabsContent>

              <TabsContent value="tracks" className="mt-0">
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
              </TabsContent>

              <TabsContent value="notify" className="mt-0">
                <EmailDashboard
                  eventId={eventId}
                  eventName={event.event_name}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </PageContent>
    </PageContainer>
  );
}
