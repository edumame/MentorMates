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
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

export function OrganizerDashboard({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scoringConfig, setScoringConfig] = useState<EventScoringConfig | null>(
    null
  );
  const [activeTab, setActiveTab] = useState("details");
  const router = useRouter();
  const { toast } = useToast();

  const primaryTabs = [
    { value: "details", label: "Event Details", icon: Edit },
    { value: "access", label: "Access", icon: Shield },
    { value: "tracks", label: "Tracks", icon: FolderKanban },
    { value: "participants", label: "Participants", icon: Users },
    { value: "assign", label: "Assign", icon: UserCheck },
    { value: "submissions", label: "Submissions", icon: FileText },
    { value: "scores", label: "Live Scores", icon: BarChart },
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
        <TabsList className="mb-8 w-full overflow-x-auto gap-1">
          {primaryTabs.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              title={item.label}
              className="flex items-center gap-2 px-2 py-1 sm:px-3 sm:py-1.5"
            >
              <item.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </TabsTrigger>
          ))}

          {overflowTabs.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              title={item.label}
              className="hidden sm:inline-flex items-center gap-2 px-2 py-1 sm:px-3 sm:py-1.5"
            >
              <item.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </TabsTrigger>
          ))}

          <div className="ml-auto flex sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <MoreHorizontal className="h-4 w-4" />
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {overflowTabs.map((item) => (
                  <DropdownMenuItem key={item.value} onClick={() => setActiveTab(item.value)}>
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
