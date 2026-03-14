"use client";

import { useRef, useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/hooks/use-toast";
import { Archive, Trash2, ArrowUpRight, Send, ChevronDown } from "lucide-react";
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
import { SubmissionsTab } from "@/features/user/dashboards/dashboard/organizer/submissions";
import { ScoresTab } from "@/features/user/dashboards/dashboard/organizer/scores";
import { PricingTab } from "@/features/user/dashboards/dashboard/organizer/pricing/PricingTab";
import EmailDashboard from "@/features/user/dashboards/dashboard/organizer/notifications/EmailDashboard";
import { EmailTab } from "@/features/user/dashboards/dashboard/organizer/email";
import { ProjectImport } from "@/features/user/dashboards/dashboard/organizer/import/ProjectImportButton";
import { AgentsTab } from "@/features/user/dashboards/dashboard/organizer/agents/AgentsTab";
import { IntakeFormBuilder } from "@/features/intake-forms/components/IntakeFormBuilder";

// Import sub-tab components for Overview
import { BasicInfoTab } from "@/features/user/dashboards/dashboard/organizer/details/BasicInfoTab";
import { ContentTab } from "@/features/user/dashboards/dashboard/organizer/details/ContentTab";
import { ScheduleTab } from "@/features/user/dashboards/dashboard/organizer/details/ScheduleTab";
import { ResourcesTab } from "@/features/user/dashboards/dashboard/organizer/details/ResourcesTab";
import { RulesTab } from "@/features/user/dashboards/dashboard/organizer/details/RulesTab";
import { FAQTab } from "@/features/user/dashboards/dashboard/organizer/details/FAQTab";
import { IntakeResponsesTab } from "@/features/user/dashboards/dashboard/organizer/registration";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [submittingForApproval, setSubmittingForApproval] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Use URL as single source of truth for tab state
  const activeTab = searchParams.get("tab") || "overview";
  const activeSubTab = searchParams.get("subtab") || "basics";

  const basicInfoSaveHandlerRef = useRef<null | (() => Promise<void> | void)>(
    null
  );

  const [participantCount, setParticipantCount] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);

  // Primary tabs in the bar (Advanced Settings is a dropdown)
  const mainTabs = [
    { value: "participants", label: "Registration", badge: participantCount },
    { value: "project", label: "Project" },
    { value: "access", label: "Access" },
    { value: "tracks", label: "Tracks & Prizes" },
    { value: "advanced-settings", label: "Advanced Settings" },
  ];

  const advancedTabValues = [
    "overview",
    "intake-forms",
    "intake-responses",
    "ticketing",
    "notify",
    "agents",
  ] as const;
  const advancedTabs = [
    { value: "overview", label: "Edit Event" },
    { value: "intake-forms", label: "Intake Forms" },
    { value: "intake-responses", label: "Intake Responses" },
    { value: "ticketing", label: "Ticketing" },
    { value: "notify", label: "Notify" },
    { value: "agents", label: "Agents" },
  ];
  const isAdvancedTab = (tab: string) => advancedTabValues.includes(tab as (typeof advancedTabValues)[number]);
  const projectSubTabValues = ["submission", "live-scores"] as const;
  const projectSubTabs = [
    { value: "submission", label: "Submission" },
    { value: "live-scores", label: "Live Score" },
  ];
  const projectSubTab = activeTab === "project"
    ? (projectSubTabValues.includes(searchParams.get("subtab") as (typeof projectSubTabValues)[number])
        ? searchParams.get("subtab")
        : "submission")
    : "submission";
  const isProjectTab = (tab: string) => tab === "project-submission" || tab === "live-scores" || tab === "project";
  const tabsValue = isAdvancedTab(activeTab) ? "advanced-settings" : isProjectTab(activeTab) ? "project" : activeTab;

  const accessSubTabValues = ["password", "role-labels", "invite-organizers"] as const;
  const accessSubTab: (typeof accessSubTabValues)[number] =
    activeTab === "access"
      ? (accessSubTabValues.includes(searchParams.get("subtab") as (typeof accessSubTabValues)[number])
          ? (searchParams.get("subtab") as (typeof accessSubTabValues)[number]) ?? "password"
          : "password")
      : "password";

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
      if (tab === "overview") {
        params.set("subtab", "basics");
      } else if (tab === "project") {
        params.set("subtab", "submission");
      } else if (tab === "access") {
        params.set("subtab", "password");
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

  const handleAccessVisibilityChange = async (value: EventVisibility) => {
    try {
      const { error } = await supabase
        .from("events")
        .update({ visibility: value })
        .eq("event_id", eventId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update event visibility",
          variant: "destructive",
        });
        return;
      }

      setEvent((prev) => {
        if (!prev) return prev;
        return { ...prev, visibility: value };
      });

      toast({
        title: "Success",
        description: "Event visibility updated successfully",
      });
    } catch (err) {
      console.error("Error updating event visibility:", err);
      toast({
        title: "Error",
        description: "Failed to update event visibility",
        variant: "destructive",
      });
    }
  };

  // Redirect legacy tab=assign to participants (Assign is now under Participants → Assign Roles)
  useEffect(() => {
    if (searchParams.get("tab") === "assign") {
      startTransition(() => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", "participants");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }
  }, [pathname, router, searchParams]);

  // Redirect legacy project-submission / live-scores to Project tab with subtab
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "project-submission" || tab === "live-scores") {
      startTransition(() => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", "project");
        params.set("subtab", tab === "live-scores" ? "live-scores" : "submission");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
      return;
    }
    if (tab === "project" && !projectSubTabValues.includes(searchParams.get("subtab") as (typeof projectSubTabValues)[number])) {
      startTransition(() => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", "project");
        params.set("subtab", "submission");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }
  }, [pathname, router, searchParams]);

  // Redirect access tab to valid subtab
  useEffect(() => {
    if (activeTab !== "access") return;
    const subtab = searchParams.get("subtab");
    if (subtab && accessSubTabValues.includes(subtab as (typeof accessSubTabValues)[number])) return;
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      params.set("tab", "access");
      params.set("subtab", "password");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [activeTab, pathname, router, searchParams]);

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
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : String(error);
      const code = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : undefined;
      console.error("Error fetching event:", message, code ?? "");
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

  const handleSubmitForApproval = async () => {
    if (!event) return;

    try {
      setSubmittingForApproval(true);

      const res = await fetch("/api/events/request-approval", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventId: event.event_id }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to submit event for approval");
      }

      await res.json();

      // Update local state with new approval status
      setEvent({
        ...event,
        approval_status: ApprovalStatus.Submitted,
      });

      toast({
        title: "Success",
        description: "Event submitted for approval. An admin will review it soon.",
      });

      // Refresh the page to update any cached data
      router.refresh();
    } catch (error) {
      console.error("Error submitting event for approval:", error);
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSubmittingForApproval(false);
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
    <div className="w-full overflow-x-hidden flex flex-col flex-1 min-h-0">
      <div className="w-full flex flex-col flex-1 min-h-0">
        {/* 头部 + Tabs 固定，仅下方内容区滚动；背景由右侧 100dvh 区域统一提供 */}
        <div className="px-4 sm:px-6 lg:px-10 pt-0 w-full flex flex-col flex-1 min-h-0 overflow-x-hidden">
          {/* Header with title, action buttons, and notification+avatar (below left nav) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 flex-shrink-0">
            <div className="flex items-center gap-2">
              <h1
                className="flex flex-col justify-center flex-1 min-w-0 self-stretch font-geist text-[28px] font-semibold leading-[140%] tracking-[-1.68px] text-[var(--Color-Scheme-1-Text,#000)]"
              >
                Manage Event
              </h1>
              {event.visibility && (
                <Badge
                  className={`ml-1 font-sans font-normal text-[11px] leading-[1.5] ${
                    event.visibility === EventVisibility.Draft
                      ? "bg-orange-500/20 hover:bg-orange-500/20 text-black border-none"
                      : event.visibility === EventVisibility.Public
                        ? "bg-green-500/20 hover:bg-green-500/20 text-black border-none"
                        : "bg-gray-500/20 hover:bg-gray-500/20 text-black border-none"
                  }`}
                >
                  {event.visibility.toUpperCase()}
                </Badge>
              )}

              <Badge
                variant="secondary"
                className={`font-sans font-normal text-[11px] leading-[1.5] ${
                  event.approval_status === ApprovalStatus.Submitted
                    ? "bg-blue-500/20 hover:bg-blue-500/20 text-black border-none"
                    : event.approval_status === ApprovalStatus.Approved
                      ? "bg-green-500/20 hover:bg-green-500/20 text-black border-none"
                      : event.approval_status === ApprovalStatus.Rejected
                        ? "bg-red-500/20 hover:bg-red-500/20 text-black border-none"
                        : "bg-gray-500/20 hover:bg-gray-500/20 text-black border-none"
                }`}
              >
                {event.approval_status?.replace(/_/g, ' ').toUpperCase() || "NOT SUBMITTED"}
              </Badge>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center sm:items-stretch">
              {/* Profile lives in left nav (SideNav) below Notification */}
              {/* Submit for Approval Button - Only show for private events that haven't been submitted or were rejected */}
              {event.visibility === EventVisibility.Private &&
                (event.approval_status === ApprovalStatus.NotSubmitted ||
                  event.approval_status === ApprovalStatus.Rejected ||
                  !event.approval_status) && (
                  <Button
                    variant="default"
                    className="gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium w-full sm:w-auto whitespace-normal sm:whitespace-nowrap"
                    disabled={submittingForApproval || archiving || deleting}
                    onClick={handleSubmitForApproval}
                  >
                    <Send className="w-4 h-4 flex-shrink-0" />
                    <span className="text-center">
                      {submittingForApproval
                        ? "Submitting..."
                        : "Submit for Approval"}
                    </span>
                  </Button>
                )}

              <div className="flex gap-2 w-full sm:w-auto">
                {/* Archive Event Dialog */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="defaultGray"
                      className="gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium flex-1 sm:flex-none"
                      disabled={
                        archiving || event.visibility === EventVisibility.Archived
                      }
                    >
                      <Archive className="w-4 h-4" />
                      <span>
                        {archiving ? "Archiving..." : "Archive"}
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
                      variant="delete"
                      disabled={deleting}
                      className="flex-1 sm:flex-none"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
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

                {/* Update Event (Save Changes) */}
                {activeTab === "overview" && activeSubTab === "basics" && (
                  <Button
                    variant="default"
                    className="gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium flex-1 sm:flex-none bg-[#4b89ef] hover:bg-[#3d75d9]"
                    disabled={
                      saving ||
                      archiving ||
                      deleting ||
                      event.visibility === EventVisibility.Archived ||
                      !basicInfoSaveHandlerRef.current
                    }
                    onClick={() => {
                      void basicInfoSaveHandlerRef.current?.();
                    }}
                  >
                    <span>{saving ? "Updating..." : "Update Event"}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Main Tabs */}
          <Tabs
            value={tabsValue}
            onValueChange={(value) => {
              if (value !== "advanced-settings") setActiveTab(value);
            }}
            className="flex flex-col flex-1 min-h-0 w-full min-w-full"
          >
            <div className="w-full min-w-full -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 mb-[24px] flex-shrink-0 flex flex-col">
              <div
                className="overflow-x-auto no-scrollbar min-w-0"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <TabsList className="flex h-auto gap-4 sm:gap-6 items-center p-0 justify-start bg-transparent rounded-none flex-nowrap w-full min-w-full border-0 shadow-none">
                {mainTabs.map((tab) =>
                  tab.value === "advanced-settings" ? (
                    <DropdownMenu key={tab.value}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={`px-0 py-2 text-base font-normal leading-[1.5] text-[var(--Color-Scheme-1-Text,#000)] border-b-2 rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0 whitespace-nowrap flex-shrink-0 flex items-center gap-1 cursor-pointer hover:opacity-80 ${
                            tabsValue === "advanced-settings"
                              ? "font-medium text-[var(--Color-Scheme-1-Text,#000)] text-base leading-[1.5] border-[#4b89ef]"
                              : "border-transparent"
                          }`}
                        >
                          {tab.label}
                          <ChevronDown className="h-4 w-4 opacity-70" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[180px]">
                        {advancedTabs.map((adv) => (
                          <DropdownMenuItem
                            key={adv.value}
                            onClick={() => setActiveTab(adv.value)}
                            className={activeTab === adv.value ? "bg-accent" : ""}
                          >
                            {adv.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="px-0 py-2 text-base font-normal leading-[1.5] text-[var(--Color-Scheme-1-Text,#000)] border-b-2 border-transparent data-[state=active]:font-medium data-[state=active]:text-[var(--Color-Scheme-1-Text,#000)] data-[state=active]:text-base data-[state=active]:leading-[1.5] data-[state=active]:border-[#4b89ef] data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none bg-transparent shadow-none outline-none ring-0 border-x-0 border-t-0 whitespace-nowrap flex-shrink-0 flex items-center gap-2"
                    >
                      {tab.label}
                      {tab.badge !== undefined && tab.badge > 0 && (
                        <span className="bg-white border border-[rgba(0,0,0,0.15)] px-2 py-0 rounded-full text-[12px] font-normal">
                          {tab.badge}
                        </span>
                      )}
                    </TabsTrigger>
                  )
                )}
              </TabsList>
              </div>
              {/* Full-width line: extend right to match content area (Export CSV etc.) */}
              <div
                className="border-b border-[#d2d7e7] shrink-0 w-[calc(100%+2rem)] -mr-4 sm:w-[calc(100%+3rem)] sm:-mr-6 lg:w-[calc(100%+5rem)] lg:-mr-10"
                aria-hidden
              />
            </div>

            {tabsValue === "access" && event && (
              <div className="w-full pl-0 pr-4 sm:pr-6 lg:pr-10 mb-0 flex-shrink-0 flex flex-col items-start gap-0">
                <Tabs
                  value={accessSubTab}
                  onValueChange={(v) => setActiveSubTab(v)}
                >
                  <div className="flex flex-col items-start gap-0 w-full">
                    <div
                      className="w-screen -mx-4 sm:-mx-6 lg:w-full lg:mx-0 overflow-x-auto no-scrollbar overflow-y-visible pl-0 pr-4 sm:pr-6 lg:pr-0"
                      style={{ WebkitOverflowScrolling: "touch" }}
                    >
                      <TabsList className="inline-flex h-auto gap-0 bg-transparent p-0 justify-start items-center flex-nowrap min-w-max border-0 shadow-none rounded-none">
                        <TabsTrigger
                          value="password"
                          className="min-w-[140px] px-3 py-2.5 rounded-[100px] text-base leading-[1.5] font-normal text-[var(--Color-Scheme-1-Text,#000)] border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] data-[state=active]:shadow-none flex-shrink-0"
                        >
                          Password
                        </TabsTrigger>
                        <TabsTrigger
                          value="role-labels"
                          className="min-w-[140px] px-3 py-2.5 rounded-[100px] text-base leading-[1.5] font-normal text-[var(--Color-Scheme-1-Text,#000)] border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] data-[state=active]:shadow-none flex-shrink-0"
                        >
                          Role Labels
                        </TabsTrigger>
                        <TabsTrigger
                          value="invite-organizers"
                          className="min-w-[140px] px-3 py-2.5 rounded-[100px] text-base leading-[1.5] font-normal text-[var(--Color-Scheme-1-Text,#000)] border border-transparent data-[state=active]:font-medium data-[state=active]:bg-white data-[state=active]:border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] data-[state=active]:shadow-none flex-shrink-0"
                        >
                          Invite Organizers
                        </TabsTrigger>
                      </TabsList>
                    </div>
                    {accessSubTab === "password" && (
                      <div className="mt-[24px] flex items-center justify-start">
                        <Select
                          value={event.visibility || ""}
                          onValueChange={(value) =>
                            handleAccessVisibilityChange(value as EventVisibility)
                          }
                          disabled={event.visibility === "archived"}
                        >
                          <SelectTrigger className="flex w-[142px] h-11 items-center gap-2 rounded-[12px] border border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] bg-[var(--Color-White,#FFF)] px-3 py-2 text-base font-normal leading-[1.5] text-[var(--Color-Scheme-1-Text,#000)] shadow-none">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              className="h-5 w-5 shrink-0"
                              aria-hidden
                            >
                              <path
                                d="M12.0086 22.1487C10.6052 22.1487 9.28823 21.8831 8.05756 21.3517C6.8269 20.8204 5.75056 20.0938 4.82856 19.1718C3.90656 18.2498 3.1799 17.1731 2.64856 15.9417C2.11723 14.7104 1.85156 13.3923 1.85156 11.9875C1.85156 10.5828 2.11723 9.2645 2.64856 8.0325C3.1799 6.80067 3.90623 5.72783 4.82756 4.814C5.7489 3.9 6.8254 3.1765 8.05706 2.6435C9.28873 2.11033 10.6071 1.84375 12.0123 1.84375C13.4173 1.84375 14.7361 2.11017 15.9686 2.643C17.2009 3.17583 18.2738 3.89892 19.1873 4.81225C20.101 5.72558 20.8242 6.79958 21.3571 8.03425C21.8901 9.26892 22.1566 10.5883 22.1566 11.9925C22.1566 13.3965 21.89 14.7137 21.3568 15.9442C20.8238 17.1749 20.1003 18.2495 19.1863 19.168C18.2725 20.0863 17.1986 20.8127 15.9646 21.3472C14.7306 21.8816 13.4119 22.1487 12.0086 22.1487ZM12.0011 20.4455C14.3062 20.4455 16.2663 19.6552 17.8813 18.0745C19.4963 16.4938 20.3396 14.5743 20.4113 12.316C20.4113 12.2733 20.4123 12.2374 20.4143 12.2082C20.4163 12.1792 20.4173 12.1467 20.4173 12.1107C20.2935 12.4962 20.0621 12.8159 19.7233 13.0697C19.3846 13.3234 18.9899 13.4502 18.5391 13.4502H16.5691C16.0042 13.4502 15.5207 13.249 15.1186 12.8465C14.7164 12.4438 14.5153 11.9598 14.5153 11.3945V10.3667H10.4076V8.35125C10.4076 7.78225 10.6089 7.29725 11.0116 6.89625C11.4141 6.49542 11.898 6.295 12.4633 6.295H13.4913V5.745C13.4913 5.457 13.6068 5.10633 13.8378 4.693C14.0688 4.27983 14.3319 4.0395 14.6271 3.972C14.2144 3.8445 13.79 3.74283 13.3538 3.667C12.9178 3.591 12.4676 3.553 12.0033 3.553C9.66381 3.553 7.67081 4.3715 6.02431 6.0085C4.37798 7.64533 3.55481 9.64225 3.55481 11.9992C3.55481 12.0152 3.55581 12.0302 3.55781 12.044C3.55981 12.058 3.56081 12.073 3.56081 12.089H7.03581C8.16765 12.089 9.13523 12.4906 9.93856 13.2937C10.7419 14.0971 11.1436 15.0637 11.1436 16.1935V17.2205H8.06581V19.5047C8.65631 19.8039 9.2819 20.0355 9.94256 20.1995C10.6034 20.3635 11.2896 20.4455 12.0011 20.4455Z"
                                fill="currentColor"
                              />
                            </svg>
                            <SelectValue placeholder="Select visibility" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={EventVisibility.Private}>
                              Private
                            </SelectItem>
                            <SelectItem value={EventVisibility.Draft}>
                              Draft
                            </SelectItem>
                            {event.approval_status === ApprovalStatus.Approved && (
                              <SelectItem value={EventVisibility.Public}>
                                Public
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </Tabs>
              </div>
            )}

            {/* Content Area - 仅此区域滚动，头部与 Tabs 固定 */}
            <div
              className="flex flex-col lg:flex-row gap-6 lg:gap-12 items-start w-full flex-1 min-h-0 overflow-y-auto no-scrollbar"
              style={{
                opacity: isPending ? 0.4 : 1,
                transition: "opacity 150ms",
              }}
            >
              {/* Left Column - Form Content */}
              <div className="w-full lg:flex-[2] lg:min-w-0 flex flex-col items-start">
                {/* Advanced Settings (Overview, Intake Forms, etc.) */}
                <TabsContent value="advanced-settings" className="mt-0 w-full">
                  {activeTab === "overview" && (
                    <Tabs
                      value={activeSubTab}
                      onValueChange={(value) => setActiveSubTab(value)}
                    >
                      <div
                        className="w-screen -mx-4 sm:-mx-6 lg:w-full lg:mx-0 overflow-x-auto no-scrollbar overflow-y-visible px-4 sm:px-6 lg:px-0 mb-6"
                        style={{ WebkitOverflowScrolling: "touch" }}
                      >
                        <TabsList className="inline-flex h-auto gap-2 bg-transparent p-0 justify-start pb-1 items-center flex-nowrap min-w-max">
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
                              registerSaveHandler={(fn) => {
                                basicInfoSaveHandlerRef.current = fn;
                              }}
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
                  )}
                  {activeTab === "intake-forms" && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-semibold mb-4 text-black">
                          Project Submission Intake Form
                        </h2>
                        <IntakeFormBuilder
                          eventId={eventId}
                          context="project_submission"
                        />
                      </div>
                      <div className="border-t border-[rgba(0,0,0,0.15)] pt-6">
                        <h2 className="text-xl font-semibold mb-4 text-black">
                          Registration Intake Form
                        </h2>
                        <IntakeFormBuilder eventId={eventId} context="registration" />
                      </div>
                    </div>
                  )}
                  {activeTab === "intake-responses" && (
                    <IntakeResponsesTab eventId={eventId} />
                  )}
                  {activeTab === "ticketing" && (
                    isAdmin ? (
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
                    )
                  )}
                  {activeTab === "notify" && event && (
                    <div className="space-y-6">
                      <EmailDashboard
                        eventId={eventId}
                        eventName={event.event_name}
                      />
                      <div className="border-t border-[rgba(0,0,0,0.15)] pt-6">
                        <h2 className="text-xl font-semibold mb-4 text-black">
                          Email Event Participants
                        </h2>
                        <EmailTab eventId={eventId} />
                      </div>
                    </div>
                  )}
                  {activeTab === "agents" && (
                    <AgentsTab eventId={eventId} />
                  )}
                </TabsContent>

                {/* Other Main Tabs */}
                <TabsContent value="participants" className="mt-0 w-full">
                  {event && (
                    <ParticipantsTab 
                      eventId={eventId} 
                      event={event}
                      setEvent={setEvent}
                      isArchived={event.visibility === "archived"}
                    />
                  )}
                </TabsContent>

                <TabsContent value="access" className="mt-0 w-full">
                  {event && (
                    <div className="mt-[24px]">
                      <AccessTab
                        eventId={eventId}
                        event={event}
                        setEvent={setEvent}
                        saving={saving}
                        setSaving={setSaving}
                        activeSubTab={accessSubTab}
                      />
                    </div>
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

                <TabsContent value="project" className="mt-0 w-full">
                  <Tabs
                    value={projectSubTab ?? "submission"}
                    onValueChange={(v) => setActiveSubTab(v)}
                    className="w-full"
                  >
                    <TabsList className="flex h-auto gap-2 p-0 justify-start bg-transparent border-0 shadow-none rounded-none mb-6">
                      <TabsTrigger
                        value="submission"
                        className="flex items-center justify-center px-4 py-2.5 rounded-[100px] text-base leading-[1.5] text-[var(--Color-Scheme-1-Text,#000)] font-normal border border-transparent bg-transparent data-[state=active]:font-medium data-[state=active]:bg-[var(--Color-Scheme-1-Foreground,#FFF)] data-[state=active]:border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] data-[state=active]:shadow-none"
                      >
                        Submission
                      </TabsTrigger>
                      <TabsTrigger
                        value="live-scores"
                        className="flex items-center justify-center px-4 py-2.5 rounded-[100px] text-base leading-[1.5] text-[var(--Color-Scheme-1-Text,#000)] font-normal border border-transparent bg-transparent data-[state=active]:font-medium data-[state=active]:bg-[var(--Color-Scheme-1-Foreground,#FFF)] data-[state=active]:border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] data-[state=active]:shadow-none"
                      >
                        Live Score
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="submission" className="mt-0">
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
                    <TabsContent value="live-scores" className="mt-0">
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
                  </Tabs>
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
