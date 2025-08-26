"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/lib/hooks/use-toast";
import { canAccessRole } from "@/features/user/roles/roles";
import {
  Edit,
  Users,
  Shield,
  FileText,
  BarChart,
  FolderKanban,
  UserCheck,
  Import,
  Upload,
  DollarSign,
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
import { EventDetailsTab } from "./details";
import { ParticipantsTab } from "./participants";
import { EventTracksContainer } from "./tracks";
import { AccessTab } from "./access";
import { AssignTab } from "./assign";
import { ProjectImport } from "./import/ProjectImportButton";
import SendGeneralNotification from "./notifications/SendNotification";
import { PricingTab } from "./pricing/PricingTab";

export function OrganizerDashboard({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scoringConfig, setScoringConfig] = useState<EventScoringConfig | null>(
    null
  );
  const [activeTab, setActiveTab] = useState("details");
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Redirect from pricing tab if user is not admin
  useEffect(() => {
    if (activeTab === "pricing" && !isAdmin) {
      setActiveTab("details");
    }
  }, [activeTab, isAdmin]);
  const primaryTabs = [
    { value: "details", label: "Event Details", icon: Edit },
    { value: "access", label: "Access", icon: Shield },
    { value: "tracks", label: "Tracks", icon: FolderKanban },
    { value: "participants", label: "Participants", icon: Users },
    { value: "assign", label: "Assign", icon: UserCheck },
    { value: "submissions", label: "Submissions", icon: FileText },
    { value: "scores", label: "Live Scores", icon: BarChart },
    { value: "pricing", label: "Pricing", icon: DollarSign },
  ];

  const overflowTabs = [
    { value: "import", label: "Import", icon: Import },
    { value: "notify", label: "Notify", icon: Upload },
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
          !canAccessRole(
            roleData.role as EventRole,
            EventRole.Organizer
          )
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
  }, [eventId, router, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Event not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-8 w-full h-auto flex flex-wrap gap-2">
          {[...primaryTabs, ...overflowTabs].map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              title={item.label}
              className="inline-flex items-center gap-2 px-3 py-1.5"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="details">
          <EventDetailsTab
            event={event}
            setEvent={setEvent}
            saving={saving}
            setSaving={setSaving}
            router={router}
            toast={toast}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="pricing">
            <PricingTab
              event={event}
              setEvent={setEvent}
              saving={saving}
              setSaving={setSaving}
            />
          </TabsContent>
        )}

        <TabsContent value="access">
          <AccessTab
            eventId={eventId}
            event={event}
            setEvent={setEvent}
            saving={saving}
            setSaving={setSaving}
          />
        </TabsContent>

        <TabsContent value="tracks">
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

        <TabsContent value="participants">
          <ParticipantsTab eventId={eventId} />
        </TabsContent>

        <TabsContent value="assign">
          <AssignTab eventId={eventId} />
        </TabsContent>

        <TabsContent value="submissions">
          <SubmissionsTab eventId={eventId} />
        </TabsContent>

        <TabsContent value="scores">
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

        <TabsContent value="import">
          <ProjectImport eventId={eventId} />
        </TabsContent>

        <TabsContent value="notify">
          <SendGeneralNotification eventId={eventId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
