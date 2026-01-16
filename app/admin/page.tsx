"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApprovalLog } from "@/components/events/approval-log";
import { EventItem, ApprovalStatus } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/hooks/use-toast";
import {
  Loader2,
  Star,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Send,
  XCircle,
  Sparkles,
  Eye,
  Calendar,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(
    new Set()
  );
  const [activeTab, setActiveTab] = useState<"featured" | "approval">(
    "featured"
  );
  const [rejectionReasons, setRejectionReasons] = useState<
    Record<string, string>
  >({});
  const [pendingRejections, setPendingRejections] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    checkAdminAndLoadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAdminAndLoadEvents = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: isAdminData } = await supabase.rpc("is_admin_user", {
        user_id: user.id,
      });

      if (!isAdminData) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive",
        });
        router.push("/");
        return;
      }

      setIsAdmin(true);
      await loadEvents();
    } catch (error) {
      console.error("Error checking admin status:", error);
      toast({
        title: "Error",
        description: "Failed to verify admin access.",
        variant: "destructive",
      });
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select(
          `
          event_id,
          event_name,
          event_date,
          location,
          event_description,
          event_blurb,
          cover_image_url,
          visibility,
          paid,
          stripe_price_id,
          slug,
          event_type,
          featured,
          approval_status,
          rejection_reason,
          created_at
        `
        )
        .order("created_at", { ascending: true });

      if (error) throw error;

      const eventsData = data || [];
      setEvents(eventsData);
      
      // Initialize rejection reasons from database
      const initialRejectionReasons: Record<string, string> = {};
      eventsData.forEach((event: EventItem & { rejection_reason?: string | null }) => {
        if (event.rejection_reason) {
          initialRejectionReasons[event.event_id] = event.rejection_reason;
        }
      });
      setRejectionReasons(initialRejectionReasons);
    } catch (error) {
      console.error("Error loading events:", error);
      toast({
        title: "Error",
        description: "Failed to load events.",
        variant: "destructive",
      });
    }
  };

  const toggleEventExpanded = (eventId: string) => {
    setExpandedEventIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const updateEventStatus = async (
    eventId: string,
    field: "featured" | "approval_status",
    value: boolean | ApprovalStatus,
    rejectionReason?: string
  ) => {
    setUpdatingEventId(eventId);
    try {
      const body: Record<string, unknown> = { [field]: value };
      
      // Include rejection_reason if status is being set to rejected
      if (field === "approval_status" && value === ApprovalStatus.Rejected) {
        if (!rejectionReason || rejectionReason.trim() === "") {
          toast({
            title: "Error",
            description: "Rejection reason is required when rejecting an event.",
            variant: "destructive",
          });
          setUpdatingEventId(null);
          return;
        }
        body.rejection_reason = rejectionReason;
      }

      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update event");
      }

      // Update local state
      setEvents((prevEvents) =>
        prevEvents.map((event) => {
          if (event.event_id === eventId) {
            const updated = { ...event, [field]: value };
            if (field === "approval_status" && value === ApprovalStatus.Rejected && rejectionReason) {
              (updated as EventItem & { rejection_reason?: string }).rejection_reason = rejectionReason;
            } else if (field === "approval_status" && value !== ApprovalStatus.Rejected) {
              delete (updated as EventItem & { rejection_reason?: string }).rejection_reason;
            }
            return updated;
          }
          return event;
        })
      );

      // Update rejection reasons state
      if (field === "approval_status") {
        if (value === ApprovalStatus.Rejected && rejectionReason) {
          setRejectionReasons((prev) => ({
            ...prev,
            [eventId]: rejectionReason,
          }));
        } else if (value !== ApprovalStatus.Rejected) {
          setRejectionReasons((prev) => {
            const updated = { ...prev };
            delete updated[eventId];
            return updated;
          });
        }
      }

      toast({
        title: "Success",
        description: `Event ${field === "approval_status" ? "approval status" : field} updated.`,
      });
    } catch (error) {
      console.error(`Error updating event ${field}:`, error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : `Failed to update event ${field} status.`,
        variant: "destructive",
      });
    } finally {
      setUpdatingEventId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  // Separate events into queues based on approval status
  const notSubmittedEvents = events.filter(
    (event) =>
      event.approval_status === ApprovalStatus.NotSubmitted ||
      !event.approval_status
  );
  const submittedEvents = events.filter(
    (event) => event.approval_status === ApprovalStatus.Submitted
  );
  const approvedEvents = events.filter(
    (event) => event.approval_status === ApprovalStatus.Approved
  );
  const rejectedEvents = events.filter(
    (event) => event.approval_status === ApprovalStatus.Rejected
  );

  const getApprovalStatusBadge = (status?: ApprovalStatus) => {
    switch (status) {
      case ApprovalStatus.NotSubmitted:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Not Submitted
          </span>
        );
      case ApprovalStatus.Submitted:
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded flex items-center gap-1">
            <Send className="w-3 h-3" />
            Submitted
          </span>
        );
      case ApprovalStatus.Approved:
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case ApprovalStatus.Rejected:
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Not Submitted
          </span>
        );
    }
  };

  const renderEventQueue = (
    queueEvents: EventItem[],
    queueTitle: string,
    queueDescription: string,
    emptyMessage: string
  ) => (
    <div className="mb-12">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">{queueTitle}</h2>
        <p className="text-gray-600 text-sm">{queueDescription}</p>
      </div>

      {queueEvents.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queueEvents.map((event, index) => {
            const isExpanded = expandedEventIds.has(event.event_id);
            return (
              <div
                key={event.event_id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Queue Item Header */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <button
                      onClick={() => toggleEventExpanded(event.event_id)}
                      className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                    </button>

                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <span className="text-sm font-semibold text-gray-600">
                        {index + 1}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {event.event_name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {new Date(event.event_date).toLocaleDateString()} •{" "}
                        {event.location}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {event.featured && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          Featured
                        </span>
                      )}
                      {getApprovalStatusBadge(event.approval_status)}
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                        {event.visibility || "draft"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Event Details */}
                {isExpanded && (
                  <div className="border-t border-gray-200">
                    <div className="p-4 bg-gray-50">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Event Information - Left Side */}
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">
                            Event Information
                          </h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <label className="text-gray-600 font-medium">
                                Event Name
                              </label>
                              <p className="text-gray-900 mt-0.5">
                                {event.event_name}
                              </p>
                            </div>

                            <div>
                              <label className="text-gray-600 font-medium">
                                Date
                              </label>
                              <p className="text-gray-900 mt-0.5">
                                {new Date(event.event_date).toLocaleDateString(
                                  "en-US",
                                  {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  }
                                )}
                              </p>
                            </div>

                            <div>
                              <label className="text-gray-600 font-medium">
                                Location
                              </label>
                              <p className="text-gray-900 mt-0.5">
                                {event.location}
                              </p>
                            </div>

                            {event.event_blurb && (
                              <div>
                                <label className="text-gray-600 font-medium">
                                  Description
                                </label>
                                <p className="text-gray-900 mt-0.5 line-clamp-3">
                                  {event.event_blurb}
                                </p>
                              </div>
                            )}

                            <div>
                              <label className="text-gray-600 font-medium">
                                Event Type
                              </label>
                              <p className="text-gray-900 mt-0.5">
                                {event.event_type || "Not specified"}
                              </p>
                            </div>

                            <div>
                              <label className="text-gray-600 font-medium">
                                Visibility
                              </label>
                              <p className="text-gray-900 mt-0.5 capitalize">
                                {event.visibility || "draft"}
                              </p>
                            </div>

                            {event.paid && (
                              <div>
                                <label className="text-gray-600 font-medium">
                                  Pricing
                                </label>
                                <p className="text-gray-900 mt-0.5">
                                  Paid Event
                                </p>
                              </div>
                            )}

                            {event.slug && (
                              <div>
                                <label className="text-gray-600 font-medium">
                                  Slug
                                </label>
                                <p className="text-gray-900 mt-0.5 font-mono text-xs">
                                  {event.slug}
                                </p>
                              </div>
                            )}

                            <div>
                              <label className="text-gray-600 font-medium">
                                Created
                              </label>
                              <p className="text-gray-900 mt-0.5">
                                {event.created_at
                                  ? new Date(
                                      event.created_at
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-gray-200">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  router.push(
                                    `/events/${event.slug || event.event_id}/overview`
                                  )
                                }
                                className="w-full"
                              >
                                View Full Event Details →
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Admin Controls and Approval Log - Right Side */}
                        <div className="space-y-4">
                          {/* Admin Controls */}
                          <div className="bg-white rounded-lg p-4 border border-gray-200 relative">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">
                              Admin Controls
                            </h4>
                            <div className="space-y-3">
                              {/* Featured Control */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`featured-${event.event_id}`}
                                    checked={event.featured || false}
                                    onCheckedChange={(checked) =>
                                      updateEventStatus(
                                        event.event_id,
                                        "featured",
                                        checked as boolean
                                      )
                                    }
                                    disabled={
                                      updatingEventId === event.event_id
                                    }
                                  />
                                  <label
                                    htmlFor={`featured-${event.event_id}`}
                                    className="flex items-center gap-1 text-sm font-medium text-gray-700 cursor-pointer"
                                  >
                                    <Star className="w-4 h-4 text-yellow-500" />
                                    Featured
                                  </label>
                                </div>
                                {event.featured && (
                                  <span className="text-xs text-yellow-600 font-semibold">
                                    ⭐ LIVE
                                  </span>
                                )}
                              </div>

                              {/* Approval Status Control */}
                              <div className="space-y-2">
                                <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                  Approval Status
                                </label>
                                <Select
                                  value={
                                    event.approval_status ||
                                    ApprovalStatus.NotSubmitted
                                  }
                                  onValueChange={(value) => {
                                    const newStatus = value as ApprovalStatus;
                                    if (newStatus === ApprovalStatus.Rejected) {
                                      // If rejecting, check if we have a reason
                                      const reason = rejectionReasons[event.event_id] || "";
                                      if (!reason || reason.trim() === "") {
                                        // Mark as pending rejection to show textarea
                                        setPendingRejections((prev) => new Set(prev).add(event.event_id));
                                        return;
                                      }
                                      // Clear pending flag and update
                                      setPendingRejections((prev) => {
                                        const updated = new Set(prev);
                                        updated.delete(event.event_id);
                                        return updated;
                                      });
                                      updateEventStatus(
                                        event.event_id,
                                        "approval_status",
                                        newStatus,
                                        reason
                                      );
                                    } else {
                                      // Clear pending rejection if changing away from rejected
                                      setPendingRejections((prev) => {
                                        const updated = new Set(prev);
                                        updated.delete(event.event_id);
                                        return updated;
                                      });
                                      updateEventStatus(
                                        event.event_id,
                                        "approval_status",
                                        newStatus
                                      );
                                    }
                                  }}
                                  disabled={updatingEventId === event.event_id}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem
                                      value={ApprovalStatus.NotSubmitted}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-gray-500" />
                                        Not Submitted
                                      </div>
                                    </SelectItem>
                                    <SelectItem
                                      value={ApprovalStatus.Submitted}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Send className="w-4 h-4 text-blue-500" />
                                        Submitted
                                      </div>
                                    </SelectItem>
                                    <SelectItem value={ApprovalStatus.Approved}>
                                      <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                        Approved
                                      </div>
                                    </SelectItem>
                                    <SelectItem value={ApprovalStatus.Rejected}>
                                      <div className="flex items-center gap-2">
                                        <XCircle className="w-4 h-4 text-red-500" />
                                        Rejected
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                
                                {/* Rejection Reason Input */}
                                {(event.approval_status === ApprovalStatus.Rejected || 
                                  pendingRejections.has(event.event_id) ||
                                  rejectionReasons[event.event_id]) && (
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                      <XCircle className="w-4 h-4 text-red-500" />
                                      Rejection Reason
                                      <span className="text-red-500">*</span>
                                    </label>
                                    <Textarea
                                      placeholder="Enter the reason for rejection..."
                                      value={rejectionReasons[event.event_id] || ""}
                                      onChange={(e) => {
                                        const reason = e.target.value;
                                        setRejectionReasons((prev) => ({
                                          ...prev,
                                          [event.event_id]: reason,
                                        }));
                                        
                                        // If status is already rejected, update immediately
                                        if (event.approval_status === ApprovalStatus.Rejected && reason.trim()) {
                                          updateEventStatus(
                                            event.event_id,
                                            "approval_status",
                                            ApprovalStatus.Rejected,
                                            reason
                                          );
                                        }
                                      }}
                                      disabled={updatingEventId === event.event_id}
                                      className="min-h-[100px]"
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const reason = rejectionReasons[event.event_id] || "";
                                        if (!reason || reason.trim() === "") {
                                          toast({
                                            title: "Error",
                                            description: "Please enter a rejection reason.",
                                            variant: "destructive",
                                          });
                                          return;
                                        }
                                        updateEventStatus(
                                          event.event_id,
                                          "approval_status",
                                          ApprovalStatus.Rejected,
                                          reason
                                        );
                                      }}
                                      disabled={
                                        updatingEventId === event.event_id ||
                                        !rejectionReasons[event.event_id] ||
                                        rejectionReasons[event.event_id].trim() === ""
                                      }
                                      className="w-full"
                                    >
                                      Apply Rejection
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {/* Event Details */}
                              <div className="pt-2 border-t border-gray-200">
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span>
                                    Visibility: {event.visibility || "draft"}
                                  </span>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() =>
                                      router.push(
                                        `/events/${event.slug || event.event_id}/overview`
                                      )
                                    }
                                    className="h-auto p-0 text-xs"
                                  >
                                    View Event →
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {updatingEventId === event.event_id && (
                              <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                              </div>
                            )}
                          </div>

                          {/* Approval Log */}
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <ApprovalLog eventId={event.event_id} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Get featured events
  const featuredEvents = events.filter((event) => event.featured);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Event Management Dashboard
          </h1>
          <p className="text-gray-600">
            Manage featured events and review approval requests.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab("featured")}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "featured"
                  ? "border-yellow-500 text-yellow-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Featured Events
                {featuredEvents.length > 0 && (
                  <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {featuredEvents.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab("approval")}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "approval"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Approval Queue
                {submittedEvents.length > 0 && (
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {submittedEvents.length}
                  </span>
                )}
              </div>
            </button>
          </nav>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No events found.</p>
          </div>
        ) : (
          <>
            {/* Featured Events Dashboard */}
            {activeTab === "featured" && (
              <div className="space-y-6">
                {/* Featured Events Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <Star className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Featured Events</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {featuredEvents.length}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">
                          Approved & Featured
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {
                            featuredEvents.filter(
                              (e) =>
                                e.approval_status === ApprovalStatus.Approved
                            ).length
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Eye className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Public Featured</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {
                            featuredEvents.filter(
                              (e) =>
                                e.visibility === "public" &&
                                e.approval_status === ApprovalStatus.Approved
                            ).length
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Featured Events List */}
                <div className="bg-white rounded-lg border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-500" />
                      Featured Events Management
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Events marked as featured will appear on the homepage.
                      Manage their visibility and approval status below.
                    </p>
                  </div>

                  {featuredEvents.length === 0 ? (
                    <div className="text-center py-12">
                      <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">
                        No featured events yet.
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        Mark events as featured in the approval queue below.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {featuredEvents.map((event) => {
                        const isExpanded = expandedEventIds.has(event.event_id);
                        return (
                          <div
                            key={event.event_id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            {/* Featured Event Row */}
                            <div className="p-4 flex items-center justify-between">
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <button
                                  onClick={() =>
                                    toggleEventExpanded(event.event_id)
                                  }
                                  className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
                                  aria-label={
                                    isExpanded ? "Collapse" : "Expand"
                                  }
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-5 h-5 text-gray-600" />
                                  ) : (
                                    <ChevronRight className="w-5 h-5 text-gray-600" />
                                  )}
                                </button>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-gray-900 truncate">
                                      {event.event_name}
                                    </h3>
                                    <span className="flex-shrink-0 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                                      ⭐ Featured
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-sm text-gray-500">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3.5 h-3.5" />
                                      {new Date(
                                        event.event_date
                                      ).toLocaleDateString()}
                                    </span>
                                    <span>•</span>
                                    <span>{event.location}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {getApprovalStatusBadge(
                                    event.approval_status
                                  )}
                                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                                    {event.visibility || "draft"}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 ml-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    router.push(
                                      `/events/${event.slug || event.event_id}/overview`
                                    )
                                  }
                                >
                                  View Event
                                </Button>
                              </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="border-t border-gray-200 bg-gray-50">
                                <div className="p-4">
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {/* Event Information */}
                                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                                      <h4 className="text-sm font-semibold text-gray-900 mb-3">
                                        Event Information
                                      </h4>
                                      <div className="space-y-3 text-sm">
                                        <div>
                                          <label className="text-gray-600 font-medium">
                                            Event Name
                                          </label>
                                          <p className="text-gray-900 mt-0.5">
                                            {event.event_name}
                                          </p>
                                        </div>

                                        <div>
                                          <label className="text-gray-600 font-medium">
                                            Date
                                          </label>
                                          <p className="text-gray-900 mt-0.5">
                                            {new Date(
                                              event.event_date
                                            ).toLocaleDateString("en-US", {
                                              weekday: "long",
                                              year: "numeric",
                                              month: "long",
                                              day: "numeric",
                                            })}
                                          </p>
                                        </div>

                                        <div>
                                          <label className="text-gray-600 font-medium">
                                            Location
                                          </label>
                                          <p className="text-gray-900 mt-0.5">
                                            {event.location}
                                          </p>
                                        </div>

                                        {event.event_blurb && (
                                          <div>
                                            <label className="text-gray-600 font-medium">
                                              Description
                                            </label>
                                            <p className="text-gray-900 mt-0.5 line-clamp-3">
                                              {event.event_blurb}
                                            </p>
                                          </div>
                                        )}

                                        <div>
                                          <label className="text-gray-600 font-medium">
                                            Event Type
                                          </label>
                                          <p className="text-gray-900 mt-0.5">
                                            {event.event_type ||
                                              "Not specified"}
                                          </p>
                                        </div>

                                        <div>
                                          <label className="text-gray-600 font-medium">
                                            Visibility
                                          </label>
                                          <p className="text-gray-900 mt-0.5 capitalize">
                                            {event.visibility || "draft"}
                                          </p>
                                        </div>

                                        {event.paid && (
                                          <div>
                                            <label className="text-gray-600 font-medium">
                                              Pricing
                                            </label>
                                            <p className="text-gray-900 mt-0.5">
                                              Paid Event
                                            </p>
                                          </div>
                                        )}

                                        {event.slug && (
                                          <div>
                                            <label className="text-gray-600 font-medium">
                                              Slug
                                            </label>
                                            <p className="text-gray-900 mt-0.5 font-mono text-xs">
                                              {event.slug}
                                            </p>
                                          </div>
                                        )}

                                        <div>
                                          <label className="text-gray-600 font-medium">
                                            Created
                                          </label>
                                          <p className="text-gray-900 mt-0.5">
                                            {event.created_at
                                              ? new Date(
                                                  event.created_at
                                                ).toLocaleDateString()
                                              : "N/A"}
                                          </p>
                                        </div>

                                        <div className="pt-2 border-t border-gray-200">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              router.push(
                                                `/events/${event.slug || event.event_id}/overview`
                                              )
                                            }
                                            className="w-full"
                                          >
                                            View Full Event Details →
                                          </Button>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Admin Controls and Approval Log */}
                                    <div className="space-y-4">
                                      {/* Admin Controls */}
                                      <div className="bg-white rounded-lg p-4 border border-gray-200 relative">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-3">
                                          Admin Controls
                                        </h4>
                                        <div className="space-y-3">
                                          {/* Featured Control */}
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                              <Checkbox
                                                id={`featured-${event.event_id}`}
                                                checked={
                                                  event.featured || false
                                                }
                                                onCheckedChange={(checked) =>
                                                  updateEventStatus(
                                                    event.event_id,
                                                    "featured",
                                                    checked as boolean
                                                  )
                                                }
                                                disabled={
                                                  updatingEventId ===
                                                  event.event_id
                                                }
                                              />
                                              <label
                                                htmlFor={`featured-${event.event_id}`}
                                                className="flex items-center gap-1 text-sm font-medium text-gray-700 cursor-pointer"
                                              >
                                                <Star className="w-4 h-4 text-yellow-500" />
                                                Featured
                                              </label>
                                            </div>
                                            {event.featured && (
                                              <span className="text-xs text-yellow-600 font-semibold">
                                                ⭐ LIVE
                                              </span>
                                            )}
                                          </div>

                                          {/* Approval Status Control */}
                                          <div className="space-y-2">
                                            <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                                              <CheckCircle className="w-4 h-4 text-green-500" />
                                              Approval Status
                                            </label>
                                            <Select
                                              value={
                                                event.approval_status ||
                                                ApprovalStatus.NotSubmitted
                                              }
                                              onValueChange={(value) => {
                                                const newStatus = value as ApprovalStatus;
                                                if (newStatus === ApprovalStatus.Rejected) {
                                                  // If rejecting, check if we have a reason
                                                  const reason = rejectionReasons[event.event_id] || "";
                                                  if (!reason || reason.trim() === "") {
                                                    // Mark as pending rejection to show textarea
                                                    setPendingRejections((prev) => new Set(prev).add(event.event_id));
                                                    return;
                                                  }
                                                  // Clear pending flag and update
                                                  setPendingRejections((prev) => {
                                                    const updated = new Set(prev);
                                                    updated.delete(event.event_id);
                                                    return updated;
                                                  });
                                                  updateEventStatus(
                                                    event.event_id,
                                                    "approval_status",
                                                    newStatus,
                                                    reason
                                                  );
                                                } else {
                                                  // Clear pending rejection if changing away from rejected
                                                  setPendingRejections((prev) => {
                                                    const updated = new Set(prev);
                                                    updated.delete(event.event_id);
                                                    return updated;
                                                  });
                                                  updateEventStatus(
                                                    event.event_id,
                                                    "approval_status",
                                                    newStatus
                                                  );
                                                }
                                              }}
                                              disabled={
                                                updatingEventId ===
                                                event.event_id
                                              }
                                            >
                                              <SelectTrigger className="w-full">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem
                                                  value={
                                                    ApprovalStatus.NotSubmitted
                                                  }
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-gray-500" />
                                                    Not Submitted
                                                  </div>
                                                </SelectItem>
                                                <SelectItem
                                                  value={
                                                    ApprovalStatus.Submitted
                                                  }
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <Send className="w-4 h-4 text-blue-500" />
                                                    Submitted
                                                  </div>
                                                </SelectItem>
                                                <SelectItem
                                                  value={
                                                    ApprovalStatus.Approved
                                                  }
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                                    Approved
                                                  </div>
                                                </SelectItem>
                                                <SelectItem
                                                  value={
                                                    ApprovalStatus.Rejected
                                                  }
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <XCircle className="w-4 h-4 text-red-500" />
                                                    Rejected
                                                  </div>
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                            
                                            {/* Rejection Reason Input */}
                                            {(event.approval_status === ApprovalStatus.Rejected || 
                                              pendingRejections.has(event.event_id) ||
                                              rejectionReasons[event.event_id]) && (
                                              <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                                  <XCircle className="w-4 h-4 text-red-500" />
                                                  Rejection Reason
                                                  <span className="text-red-500">*</span>
                                                </label>
                                                <Textarea
                                                  placeholder="Enter the reason for rejection..."
                                                  value={rejectionReasons[event.event_id] || ""}
                                                  onChange={(e) => {
                                                    const reason = e.target.value;
                                                    setRejectionReasons((prev) => ({
                                                      ...prev,
                                                      [event.event_id]: reason,
                                                    }));
                                                    
                                                    // If status is already rejected, update immediately
                                                    if (event.approval_status === ApprovalStatus.Rejected && reason.trim()) {
                                                      updateEventStatus(
                                                        event.event_id,
                                                        "approval_status",
                                                        ApprovalStatus.Rejected,
                                                        reason
                                                      );
                                                    }
                                                  }}
                                                  disabled={updatingEventId === event.event_id}
                                                  className="min-h-[100px]"
                                                />
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => {
                                                    const reason = rejectionReasons[event.event_id] || "";
                                                    if (!reason || reason.trim() === "") {
                                                      toast({
                                                        title: "Error",
                                                        description: "Please enter a rejection reason.",
                                                        variant: "destructive",
                                                      });
                                                      return;
                                                    }
                                                    // Clear pending flag
                                                    setPendingRejections((prev) => {
                                                      const updated = new Set(prev);
                                                      updated.delete(event.event_id);
                                                      return updated;
                                                    });
                                                    // Clear pending flag
                                                    setPendingRejections((prev) => {
                                                      const updated = new Set(prev);
                                                      updated.delete(event.event_id);
                                                      return updated;
                                                    });
                                                    updateEventStatus(
                                                      event.event_id,
                                                      "approval_status",
                                                      ApprovalStatus.Rejected,
                                                      reason
                                                    );
                                                  }}
                                                  disabled={
                                                    updatingEventId === event.event_id ||
                                                    !rejectionReasons[event.event_id] ||
                                                    rejectionReasons[event.event_id].trim() === ""
                                                  }
                                                  className="w-full"
                                                >
                                                  Apply Rejection
                                                </Button>
                                              </div>
                                            )}
                                          </div>

                                          {/* Event Details */}
                                          <div className="pt-2 border-t border-gray-200">
                                            <div className="flex items-center justify-between text-xs text-gray-500">
                                              <span>
                                                Visibility:{" "}
                                                {event.visibility || "draft"}
                                              </span>
                                              <span>
                                                Created:{" "}
                                                {new Date(
                                                  event.created_at || ""
                                                ).toLocaleDateString()}
                                              </span>
                                            </div>
                                          </div>
                                        </div>

                                        {updatingEventId === event.event_id && (
                                          <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg">
                                            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                                          </div>
                                        )}
                                      </div>

                                      {/* Approval Log */}
                                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                                        <ApprovalLog eventId={event.event_id} />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Approval Queue */}
            {activeTab === "approval" && (
              <>
                {/* Submitted for Review Queue */}
                {renderEventQueue(
                  submittedEvents,
                  "Submitted for Review",
                  "Events submitted and awaiting approval, sorted by creation date (oldest first)",
                  "No events pending review."
                )}

                {/* Rejected Events Queue */}
                {renderEventQueue(
                  rejectedEvents,
                  "Rejected Events",
                  "Events that have been rejected, sorted by creation date (oldest first)",
                  "No rejected events."
                )}

                {/* Approved Events Queue */}
                {renderEventQueue(
                  approvedEvents,
                  "Approved Events",
                  "Events that have been approved, sorted by creation date (oldest first)",
                  "No approved events yet."
                )}

                {/* Not Submitted Queue */}
                {renderEventQueue(
                  notSubmittedEvents,
                  "Not Submitted",
                  "Events that haven't been submitted for approval yet, sorted by creation date (oldest first)",
                  "No unsubmitted events."
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
