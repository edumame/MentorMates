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
import { EventRole, EventItem, EventVisibility } from "@/lib/types";
import { toast } from "@/lib/hooks/use-toast";
import { getRoleLabel } from "@/features/user/roles/roles";

export interface JoinEventButtonProps {
  eventId: string;
  eventName: string;
  /**
   * Optional custom label for the main trigger button. If not provided,
   * a label will be generated based on the event's pricing information.
   */
  label?: string;
}

export function JoinEventButton({ eventId, eventName, label }: JoinEventButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
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
  const [price, setPrice] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        // Fetch the event details and role labels regardless of auth state
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select(`
            event_id,
            event_name,
            event_date,
            location,
            paid,
            price,
            visibility,
            role_labels,
            participant_capacity
          `)
          .eq("event_id", eventId)
          .maybeSingle();

        if (eventError) {
          console.error("Error fetching event:", eventError);
          throw eventError;
        }

        setEvent(eventData);
        setRoleLabels(eventData?.role_labels || null);
        // Check current participant count if capacity set
        if (eventData?.participant_capacity != null) {
          const { count } = await supabase
            .from("user_event_roles")
            .select("id", { count: "exact", head: true })
            .eq("event_id", eventId)
            .eq("role", EventRole.Participant);
          setIsFull((count || 0) >= eventData.participant_capacity);
        }

        // Set initial password visibility based on event settings
        if (eventData?.visibility === EventVisibility.Private) {
          setShowPasswordInput(true);
        }

        // Fetch price if event is paid
        if (eventData?.paid && eventData?.price) {
          setIsLoadingPrice(true);
          setPrice(eventData.price / 100);
          setIsLoadingPrice(false);
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

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
        }
      } catch (error) {
        console.error("Error checking event status:", error);
      }
    }

    init();
  }, [eventId]);

  const handleRoleSelect = (value: EventRole) => {
    setSelectedRole(value);
    // Show password input for protected roles
    if (event?.visibility === EventVisibility.Private) {
      setShowPasswordInput(true);
    } else {
      setShowPasswordInput(
        value === EventRole.Judge || value === EventRole.Organizer
      );
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

      // Check if event is paid and redirect to checkout
      if (
        event?.paid &&
        selectedRole !== EventRole.Organizer &&
        selectedRole !== EventRole.Judge
      ) {
        const { data: userPaidStatus } = await supabase
          .from("user_event_payments")
          .select("payment_status")
          .eq("user_id", session.user.id)
          .eq("event_id", eventId)
          .maybeSingle();

        if (userPaidStatus?.payment_status !== "paid") {
          // Store the event join intent in localStorage for after payment
          localStorage.setItem(
            "joinEventIntent",
            JSON.stringify({
              eventId,
              role: selectedRole,
              password: showPasswordInput ? password : undefined,
              userId: session.user.id,
            })
          );

          // Redirect to checkout with event information
          const searchParams = new URLSearchParams({
            eventId: eventId,
            eventSlug: event.slug || eventId,
            eventName: event.event_name,
          });

          router.push(`/checkout?${searchParams.toString()}`);
          return;
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
          setIsFull(true);
        }
        return;
      }

      setHasJoined(true);
      setIsDialogOpen(false);
      
      // Redirect to overview page after successful acceptance
      const overviewUrl = `/events/${event?.slug || eventId}/overview`;
      router.push(overviewUrl);
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

  if (hasJoined) {
    return null;
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen} aria-describedby="join-event-dialog">
      <DialogTrigger asChild>
        <Button className="bg-blue-700 hover:bg-blue-800">
          {label
            ? label
            : event?.paid
              ? isLoadingPrice
                ? `Join ${eventName} - Loading...`
                : price !== null
                  ? `Join ${eventName} - $${price.toFixed(2)}`
                  : `Join ${eventName} - Paid Event`
              : `Join ${eventName} - Free Event`}
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby="join-event-dialog">
        <DialogHeader>
          <DialogTitle>Choose Your Role</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select your role:</label>
            <Select value={selectedRole} onValueChange={handleRoleSelect}>
              <SelectTrigger>
                <SelectValue />
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
          </div>

          {showPasswordInput && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {event?.visibility === EventVisibility.Private
                  ? "Enter Event Password:"
                  : `Enter ${getRoleLabel(selectedRole, roleLabels)} Password:`}
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
          )}

          <Button
            onClick={handleJoinEvent}
            disabled={
              isLoading ||
              (showPasswordInput && !password) ||
              (isFull && selectedRole === EventRole.Participant)
            }
            className="w-full bg-blue-700 hover:bg-blue-800"
          >
            {isLoading ? "Joining..." : "Confirm"}
          </Button>
          {isFull && selectedRole === EventRole.Participant && (
            <p className="text-xs text-red-600 mt-2">This event is full for participants.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
