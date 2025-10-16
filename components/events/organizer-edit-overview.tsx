"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/hooks/use-toast";
import { Archive, Trash2, MapPin, ArrowUpRight } from "lucide-react";
import { EventDetails, EventScoringConfig, EventTrack, ScoringCriterion } from "@/lib/types";

// Import existing tab components
import { ParticipantsTab } from "@/features/user/dashboards/dashboard/organizer/participants";
import { AccessTab } from "@/features/user/dashboards/dashboard/organizer/access";
import { EventTracksContainer } from "@/features/user/dashboards/dashboard/organizer/tracks";
import { AssignTab } from "@/features/user/dashboards/dashboard/organizer/assign";
import { SubmissionsTab } from "@/features/user/dashboards/dashboard/organizer/submissions";
import { ScoresTab } from "@/features/user/dashboards/dashboard/organizer/scores";
import { PricingTab } from "@/features/user/dashboards/dashboard/organizer/pricing/PricingTab";
import EmailDashboard from "@/features/user/dashboards/dashboard/organizer/notifications/EmailDashboard";

// Import sub-tab components for Overview
import { BasicInfoTab } from "@/features/user/dashboards/dashboard/organizer/details/BasicInfoTab";
import { ScheduleTab } from "@/features/user/dashboards/dashboard/organizer/details/ScheduleTab";
import { ResourcesTab } from "@/features/user/dashboards/dashboard/organizer/details/ResourcesTab";
import { RulesTab } from "@/features/user/dashboards/dashboard/organizer/details/RulesTab";
import { FAQTab } from "@/features/user/dashboards/dashboard/organizer/details/FAQTab";

import { Button } from "@/components/ui/button";

interface OrganizerEditOverviewProps {
  eventId: string;
}

export function OrganizerEditOverview({ eventId }: OrganizerEditOverviewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [updating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [scoringConfig, setScoringConfig] = useState<EventScoringConfig | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [activeSubTab, setActiveSubTab] = useState<string>("basics");
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
    fetchEvent();
    fetchParticipantCount();
    checkAdminStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const checkAdminStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
        .select(`
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
        `)
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
              criteria: track.scoring_criteria.criteria.map((criterion: ScoringCriterion) => ({
                id: criterion.id,
                name: criterion.name,
                description: criterion.description,
                weight: criterion.weight || 1,
                min: criterion.min || 1,
                max: criterion.max || 10,
                type: criterion.type || "numeric",
                options: criterion.options || [],
              })),
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

  const handleUpdate = async () => {
    toast({
      title: "Success",
      description: "Event updated successfully",
    });
    router.refresh();
  };

  const handleArchive = async () => {
    if (!confirm("Are you sure you want to archive this event?")) return;

    try {
      const { error } = await supabase
        .from("events")
        .update({ visibility: "archived" })
        .eq("event_id", eventId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Event archived successfully",
      });

      router.push("/events");
    } catch (error) {
      console.error("Error archiving event:", error);
      toast({
        title: "Error",
        description: "Failed to archive event",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this event? This action cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("event_id", eventId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Event deleted successfully",
      });

      router.push("/events");
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    }
  };

  const formatDateForPreview = (dateStr: string) => {
    if (!dateStr) return { day: "09", month: "Feb", year: "2024", weekday: "Fri" };
    const date = new Date(dateStr);
    return {
      day: date.getDate().toString().padStart(2, "0"),
      month: date.toLocaleDateString("en-US", { month: "short" }),
      year: date.getFullYear().toString(),
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
    };
  };

  const renderPreviewCard = () => {
    if (!event) return null;

    const previewDate = formatDateForPreview(event.event_date);
    const isPaidEvent = event.paid || false;

    return (
      <div className="flex-shrink-0 space-y-3">
        <div className="w-[335px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] overflow-hidden">
          {/* Image */}
          <div className="relative w-full aspect-[335/223]">
            {event.cover_image_url ? (
              <img
                src={event.cover_image_url}
                alt="Event cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-orange-400 via-red-500 to-purple-600" />
            )}

            {/* Date Badge */}
            <div className="absolute top-4 right-4 bg-white border border-[#aaaaaa] rounded-[6px] w-[112px] py-3 px-1 text-center">
              <p className="text-[14px] font-normal text-black">{previewDate.weekday}</p>
              <p className="text-[36px] font-semibold leading-[1.3] tracking-[-2.16px] text-black" style={{ fontFamily: "Geist, sans-serif" }}>
                {previewDate.day}
              </p>
              <p className="text-[14px] font-normal text-black">
                {previewDate.month} {previewDate.year}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="flex flex-wrap gap-1 mb-3">
              <span className="px-[10px] py-1 border border-[rgba(0,0,0,0.15)] rounded-full text-[14px] font-semibold text-black">
                Hackathon
              </span>
              <span className="px-[10px] py-1 border border-[rgba(0,0,0,0.15)] rounded-full text-[14px] font-semibold text-black">
                {isPaidEvent ? "Paid" : "Free"}
              </span>
            </div>

            <h2
              className="text-[22px] font-semibold leading-[1.4] tracking-[-1.32px] text-black mb-1"
              style={{ fontFamily: "Geist, sans-serif" }}
            >
              {event.event_name}
            </h2>

            <div className="flex items-center gap-1 mb-2">
              <MapPin className="w-6 h-6" />
              <span className="text-[14px] font-normal text-black">
                {event.location || "Online"}
              </span>
            </div>

            <p className="text-[16px] font-normal text-black leading-[1.5]">
              {event.event_blurb || "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros."}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1 text-[#7f7f7f]">
          <span className="text-[16px]">Preview event page</span>
          <ArrowUpRight className="w-[18px] h-[18px]" />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg text-red-600">Event not found</p>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-screen"
      style={{
        background: "linear-gradient(209.28deg, rgba(219, 234, 254, 0.25) 13.188%, rgba(255, 255, 255, 0) 65.83%), linear-gradient(90deg, rgb(255, 255, 255) 0%, rgb(255, 255, 255) 100%)"
      }}
    >
      <div className="px-8 py-6 space-y-6">
        {/* Header with title and action buttons */}
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-[28px] leading-[1.4] tracking-[-1.68px] text-black" style={{ fontFamily: "Geist, sans-serif" }}>
            Manage Event
          </h1>

          <div className="flex gap-1">
            <Button
              variant="defaultGray"
              onClick={handleArchive}
              className="gap-[6px] px-6 py-[10px] text-[16px] font-medium"
            >
              <Archive className="w-6 h-6" />
              Archive
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="gap-[6px] px-6 py-[10px] text-[16px] font-medium bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-6 h-6" />
              Delete
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updating}
              className="gap-2 px-6 py-[10px] text-[16px] font-medium bg-[#4b89ef] hover:bg-[#3b79df]"
            >
              {updating ? "Updating..." : "Update Event"}
            </Button>
          </div>
        </div>

        {/* Main tabs */}
        <div className="flex gap-6 items-center border-b border-[#d2d7e7]">
          {mainTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-2 px-0 py-2 text-[16px] ${
                activeTab === tab.value
                  ? "font-medium border-b-2 border-[#4b89ef] text-black"
                  : "font-normal text-black"
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="bg-white border border-[rgba(0,0,0,0.15)] px-2 py-0 rounded-full text-[14px] font-normal">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sub-tabs for Overview */}
        {activeTab === "overview" && (
          <div className="flex gap-0 items-center">
            {overviewSubTabs.map((subTab) => (
              <button
                key={subTab.value}
                onClick={() => setActiveSubTab(subTab.value)}
                className={`px-4 py-2 rounded-full text-[16px] ${
                  activeSubTab === subTab.value
                    ? "font-medium bg-white border border-[rgba(0,0,0,0.15)] text-black"
                    : "font-normal text-black"
                }`}
              >
                {subTab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content Area */}
        <div className="w-full">
          {/* Overview Tab Content with Two-Column Layout */}
          {activeTab === "overview" && (
            <div className="flex gap-12 items-start">
              {/* Left Column - Form Content */}
              <div className="flex-1">
                {activeSubTab === "basics" && event && (
                  <BasicInfoTab
                    event={event}
                    setEvent={setEvent}
                    saving={saving}
                    setSaving={setSaving}
                    toast={toast}
                    router={router}
                  />
                )}
                {activeSubTab === "content" && (
                  <div className="text-center py-12">
                    <p className="text-lg text-gray-500">Content section coming soon</p>
                  </div>
                )}
                {activeSubTab === "schedule" && event && (
                  <ScheduleTab
                    event={event}
                    setEvent={setEvent}
                    saving={saving}
                    setSaving={setSaving}
                    toast={toast}
                  />
                )}
                {activeSubTab === "resources" && event && (
                  <ResourcesTab
                    event={event}
                    setEvent={setEvent}
                    saving={saving}
                    setSaving={setSaving}
                    toast={toast}
                  />
                )}
                {activeSubTab === "rules" && event && (
                  <RulesTab
                    event={event}
                    setEvent={setEvent}
                    saving={saving}
                    setSaving={setSaving}
                    toast={toast}
                  />
                )}
                {activeSubTab === "faqs" && event && (
                  <FAQTab
                    event={event}
                    setEvent={setEvent}
                    saving={saving}
                    setSaving={setSaving}
                    toast={toast}
                  />
                )}
                {activeSubTab === "gallery" && (
                  <div className="text-center py-12">
                    <p className="text-lg text-gray-500">Gallery section coming soon</p>
                  </div>
                )}
              </div>

              {/* Right Column - Preview Card */}
              {renderPreviewCard()}
            </div>
          )}

          {/* Participants Tab */}
          {activeTab === "participants" && (
            <ParticipantsTab eventId={eventId} />
          )}

          {/* Access Tab */}
          {activeTab === "access" && event && (
            <AccessTab
              eventId={eventId}
              event={event}
              setEvent={setEvent}
              saving={saving}
              setSaving={setSaving}
            />
          )}

          {/* Tracks Tab */}
          {activeTab === "tracks" && event && (
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

          {/* Assign Tab */}
          {activeTab === "assign" && (
            <AssignTab eventId={eventId} />
          )}

          {/* Project Submission Tab */}
          {activeTab === "project-submission" && (
            <SubmissionsTab eventId={eventId} />
          )}

          {/* Live Scores Tab */}
          {activeTab === "live-scores" && (
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
          )}

          {/* Ticketing Tab */}
          {activeTab === "ticketing" && (
            <>
              {isAdmin ? (
                <PricingTab
                  event={event!}
                  setEvent={setEvent}
                  saving={saving}
                  setSaving={setSaving}
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-lg text-gray-500">Only admins can access ticketing settings</p>
                </div>
              )}
            </>
          )}

          {/* Notify Tab */}
          {activeTab === "notify" && event && (
            <EmailDashboard eventId={eventId} eventName={event.event_name} />
          )}
        </div>
      </div>
    </div>
  );
}
