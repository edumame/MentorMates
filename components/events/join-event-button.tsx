"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
// import { createClient } from "@/app/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  EventRole,
  EventItem,
  EventVisibility,
  PricingTier,
  ParticipantRequestStatus,
  ParticipantApprovalRequest,
} from "@/lib/types";
import { toast } from "@/lib/hooks/use-toast";
import { PricingTierSelector } from "./pricing-tier-selector";
import {
  getAvailablePricingTiers,
  getCheapestPricingTier,
  formatPrice,
} from "@/lib/utils/pricing";
import { getRoleLabel, isHigherOrEqualRole } from "@/features/user/roles/roles";
import { Ticket, Users, Lock, Loader2 } from "lucide-react";

export interface JoinEventButtonProps {
  eventId: string;
  eventName: string;
  /**
   * Optional custom label for the main trigger button. If not provided,
   * a label will be generated based on the event's pricing information.
   */
  label?: string;
}

// Loading fallback component
function JoinEventButtonSkeleton() {
  return (
    <Button
      variant="default"
      size="lg"
      className="rounded-full px-6 py-5 gap-2 w-full min-w-0 overflow-hidden"
      disabled
    >
      <Ticket className="h-6 w-6 flex-shrink-0" />
      <Loader2 className="h-6 w-6 flex-shrink-0 animate-spin" />
    </Button>
  );
}

export function JoinEventButton({
  eventId,
  eventName,
  label,
}: JoinEventButtonProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedRole, setSelectedRole] = useState<EventRole>(
    EventRole.Participant
  );
  const [password, setPassword] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [roleLabels, setRoleLabels] = useState<Record<string, string> | null>(
    null
  );
  const router = useRouter();
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [selectedPricingTierId, setSelectedPricingTierId] =
    useState<string>("");
  const [showPricingTiers, setShowPricingTiers] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<ParticipantApprovalRequest | null>(null);
  const [pendingRequestStatus, setPendingRequestStatus] = useState<ParticipantRequestStatus | null>(null);

  useEffect(() => {
    async function init() {
      try {
        // Fetch the event details and role labels regardless of auth state
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select(
            `
            event_id,
            event_name,
            event_date,
            location,
            paid,
            visibility,
            role_labels,
            slug,
            participant_capacity,
            require_participant_approval
          `
          )
          .eq("event_id", eventId)
          .maybeSingle();

        if (eventError) {
          throw eventError;
        }

        setEvent(eventData);
        setRoleLabels(eventData?.role_labels || null);
        setRequiresApproval(eventData?.require_participant_approval || false);
        // Check current participant count if capacity set
        if (eventData?.participant_capacity != null) {
          const { count } = await supabase
            .from("user_event_roles")
            .select("id", { count: "exact", head: true })
            .eq("event_id", eventId)
            .eq("role", EventRole.Participant);
          setIsFull((count || 0) >= eventData.participant_capacity);
        }

        // // Set initial password visibility based on event settings
        // if (eventData?.visibility === EventVisibility.Private) {
        //   setShowPasswordInput(true);
        // }

        // Fetch pricing tiers for paid events
        if (eventData?.paid) {
          const { data: pricingTiersData, error: pricingTiersError } =
            await supabase
              .from("pricing_tiers")
              .select(
                `
              *
            `
              )
              .eq("event_id", eventId)
              .order("sort_order", { ascending: true });

          if (pricingTiersError) {
            console.error("Error fetching pricing tiers:", pricingTiersError);
          }

          if (pricingTiersData && pricingTiersData.length > 0) {
            setPricingTiers(pricingTiersData);
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        setIsAuthenticated(!!session);

        if (!session) return;

        const userId = session.user.id;

        const { data: roleData } = await supabase
          .from("user_event_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("event_id", eventId)
          .maybeSingle();

        if (roleData) {
          setHasJoined(true);
        } else {
          // Check for pending, rejected, or withdrawn approval request
          const { data: pendingRequest } = await supabase
            .from("participant_approval_requests")
            .select("id, status, rejection_reason")
            .eq("event_id", eventId)
            .eq("user_id", userId)
            .in("status", [ParticipantRequestStatus.Pending, ParticipantRequestStatus.Rejected, ParticipantRequestStatus.Withdrawn])
            .maybeSingle();

          if (pendingRequest) {
            setHasPendingRequest(true);
            setPendingRequestStatus(pendingRequest.status as ParticipantRequestStatus);
            setPendingRequest(pendingRequest as ParticipantApprovalRequest);
          }
        }
      } catch (error) {
        console.error("Error checking event status:", error);
      } finally {
        setIsInitializing(false);
      }
    }

    init();
  }, [eventId]);

  useEffect(() => {
    if (
      !showPricingTiers ||
      selectedPricingTierId ||
      pricingTiers.length === 0
    ) {
      return;
    }

    // Ensure the payment modal always has a default choice for beginner-friendly UX
    const firstAvailableTier = getAvailablePricingTiers(pricingTiers)[0];

    if (firstAvailableTier) {
      setSelectedPricingTierId(firstAvailableTier.id);
    }
  }, [showPricingTiers, pricingTiers, selectedPricingTierId]);

  const handleRoleSelect = (value: EventRole) => {
    setSelectedRole(value);
    // Show password input for protected roles
    // if (event?.visibility === EventVisibility.Private) {
    //   setShowPasswordInput(true);
    // } else {
      setShowPasswordInput(isHigherOrEqualRole(value, EventRole.Judge));
    // }
  };

  const handlePricingTierContinue = async () => {
    try {
      setIsLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        localStorage.setItem("returnUrl", window.location.pathname);
        router.push("/login");
        return;
      }

      // Store the event join intent in localStorage for after payment
      localStorage.setItem(
        "joinEventIntent",
        JSON.stringify({
          eventId,
          role: selectedRole,
          password: showPasswordInput ? password : undefined,
          userId: session.user.id,
          pricingTierId: selectedPricingTierId,
        })
      );

      // Redirect to checkout with event and pricing tier information
      const searchParams = new URLSearchParams({
        eventId: eventId,
        eventSlug: event?.slug || eventId,
        eventName: event?.event_name || eventName,
        pricingTierId: selectedPricingTierId,
      });

      router.push(`/checkout?${searchParams.toString()}`);
    } catch (error) {
      console.error("Error processing pricing tier selection:", error);
      toast({
        title: "Error",
        description: "Failed to process pricing tier selection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinEvent = async () => {
    try {
      setIsLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        localStorage.setItem("returnUrl", window.location.pathname);
        router.push("/login");
        return;
      }

      // Check if event is paid and handle pricing tier selection
      if (
        event?.paid &&
        selectedRole !== EventRole.Organizer &&
        selectedRole !== EventRole.Judge
      ) {
        const { data: userTicket } = await supabase
          .from("event_tickets")
          .select("ticket_status")
          .eq("assigned_to_user_id", session.user.id)
          .eq("event_id", eventId)
          .maybeSingle();

        if (!userTicket?.ticket_status) {
          // For paid events, always require pricing tier selection
          if (pricingTiers.length > 0) {
            setShowPricingTiers(true);
            return;
          } else {
            // No pricing tiers available for paid event
            toast({
              title: "Error",
              description:
                "This event requires payment but no pricing tiers are available. Please contact the organizer.",
              variant: "destructive",
            });
            return;
          }
        }
      }

      // Use the verify endpoint for all roles
      const response = await fetch("/api/roles/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          role: selectedRole,
          password: showPasswordInput ? password : undefined,
          userId: session.user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        toast({
          title: "Error",
          description: data.error || "Failed to join event",
          variant: "destructive",
        });
        if (response.status === 409) {
          if (data.requires_approval) {
            setHasPendingRequest(true);
            setPendingRequestStatus(ParticipantRequestStatus.Pending);
          } else {
            setIsFull(true);
          }
        }
        return;
      }

      // Check if approval was required and request was created
      if (data.requires_approval) {
        setHasPendingRequest(true);
        setPendingRequestStatus(ParticipantRequestStatus.Pending);
        setIsDialogOpen(false);
        toast({
          title: "Request Submitted",
          description: "Your request to join has been submitted and is pending organizer approval.",
        });
        return;
      }

      setHasJoined(true);
      setIsDialogOpen(false);

      // Redirect to overview page after successful acceptance
      const overviewUrl = `/events/${event?.slug || eventId}/overview`;
      router.push(overviewUrl);
      router.refresh();
    } catch (error) {
      console.error("Error joining event:", error);
      toast({
        title: "Error",
        description: "Failed to join event",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultLabel = () => {
    if (!event?.paid || !isAuthenticated) {
      return "Join Event";
    }

    if (pricingTiers.length > 0) {
      const cheapestTier = getCheapestPricingTier(pricingTiers);
      return cheapestTier
        ? `Join Event - From ${formatPrice(cheapestTier.price)}`
        : "Join Event - Multiple Tiers Available";
    }

    return "Join Event - Paid Event";
  };

  // Show loading skeleton while initializing
  if (isInitializing) {
    return <JoinEventButtonSkeleton />;
  }

  if (hasJoined) {
    return null;
  }

  const handleWithdrawRequest = async () => {
    try {
      setIsLoading(true);

      if (!pendingRequest?.id) {
        toast({
          title: "Error",
          description: "No pending request found",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`/api/events/${eventId}/approval-requests/${pendingRequest.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        toast({
          title: "Error",
          description: data.error || "Failed to withdraw request",
          variant: "destructive",
        });
        return;
      }

      setHasPendingRequest(false);
      setPendingRequestStatus(ParticipantRequestStatus.Withdrawn);
      toast({
        title: "Request Withdrawn",
        description: "Your join request has been withdrawn.",
      });
    } catch (error) {
      console.error("Error withdrawing request:", error);
      toast({
        title: "Error",
        description: "Failed to withdraw request",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show rejected request status
  if (pendingRequestStatus === ParticipantRequestStatus.Rejected) {
    const rejectionReason = (pendingRequest as ParticipantApprovalRequest)?.rejection_reason || "No reason given";
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="w-full">
              <Button
                variant="secondary"
                size="lg"
                className="rounded-full px-6 py-5 gap-2 w-full min-w-0 overflow-hidden cursor-not-allowed opacity-60"
                disabled
              >
                <Ticket className="h-6 w-6 flex-shrink-0" />
                <span className="truncate">Not Approved</span>
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent className="bg-red-500 text-white">
            <p className="max-w-xs">{rejectionReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Show pending request status
  if (hasPendingRequest && pendingRequestStatus === ParticipantRequestStatus.Pending) {
    return (
      <Button
        variant="destructive"
        size="lg"
        className="rounded-full px-6 py-5 gap-2 w-full min-w-0 overflow-hidden"
        onClick={handleWithdrawRequest}
        disabled={isLoading}
      >
        <Ticket className="h-6 w-6 flex-shrink-0" />
        <span className="truncate">{isLoading ? "Withdrawing..." : "Withdraw Request"}</span>
      </Button>
    );
  }

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={setIsDialogOpen}
      aria-describedby="join-event-dialog"
    >
      <DialogTrigger asChild>
        <Button
          variant="default"
          size="lg"
          className="rounded-full px-6 py-5 gap-2 w-full min-w-0 overflow-hidden"
        >
          <Ticket className="h-6 w-6 flex-shrink-0" />
          <span className="truncate">{label ?? getDefaultLabel()}</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby="join-event-dialog"
        className="max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            {showPricingTiers ? "Select Pricing Tier" : "Choose Your Role"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {showPricingTiers ? (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto px-1">
              {/* <Button
                variant="outline"
                onClick={() => setShowPricingTiers(false)}
                className="mb-4"
              >
                ← Back to Role Selection
              </Button> */}
              <PricingTierSelector
                pricingTiers={pricingTiers}
                selectedTierId={selectedPricingTierId}
                onTierSelect={setSelectedPricingTierId}
                onContinue={handlePricingTierContinue}
                isLoading={isLoading}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">Select your role:</label>
              <Select value={selectedRole} onValueChange={handleRoleSelect}>
                <SelectTrigger className="relative w-full flex text-left pl-10">
                  <Users className="h-6 w-6 absolute left-3 top-1/2 -translate-y-1/2" />
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EventRole.Participant}>
                    {getRoleLabel(EventRole.Participant, roleLabels)}
                  </SelectItem>
                  <SelectItem value={EventRole.Mentor}>
                    {getRoleLabel(EventRole.Mentor, roleLabels)}
                  </SelectItem>
                  <SelectItem value={EventRole.Judge}>
                    {getRoleLabel(EventRole.Judge, roleLabels)}
                  </SelectItem>
                  <SelectItem value={EventRole.Organizer}>
                    {getRoleLabel(EventRole.Organizer, roleLabels)}
                  </SelectItem>
                </SelectContent>
              </Select>

              {requiresApproval && selectedRole === EventRole.Participant && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Your request will be reviewed by the event organizers.
                  </p>
                </div>
              )}

              {showPasswordInput && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Enter password:</label>
                  <div className="flex items-center justify-start relative">
                    <Lock className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter event password"
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={handleJoinEvent}
                disabled={
                  isLoading ||
                  (showPasswordInput && !password) ||
                  (isFull && selectedRole === EventRole.Participant)
                }
                variant="default"
                className="w-full rounded-full !mt-5"
              >
                <Ticket className="h-6 w-6 mr-2" />
                {isLoading
                  ? "Submitting..."
                  : requiresApproval && selectedRole === EventRole.Participant
                  ? "Request to Join"
                  : "Confirm"}
              </Button>
            </div>
          )}
          {isFull && selectedRole === EventRole.Participant && (
            <p className="text-xs text-red-600 mt-2">
              This event is full for participants.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
