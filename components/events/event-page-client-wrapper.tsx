"use client";

import { useState } from "react";
import { EventRole } from "@/lib/types";
import { RoleBanner } from "./role-banner";
import { EventPageHeader } from "./event-page-header";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/hooks/use-toast";

interface EventPageClientWrapperProps {
  userRole: EventRole;
  eventId: string;
  eventRoleLabels?: Record<string, string> | null;
  eventName: string;
  eventBlurb: string;
  eventDate: string;
  location: string;
  coverImageUrl?: string;
  displayEventId: string;
  hasJoined: boolean;
}

export function EventPageClientWrapper({
  userRole,
  eventId,
  eventRoleLabels,
  eventName,
  eventBlurb,
  eventDate,
  location,
  coverImageUrl,
  displayEventId,
  hasJoined,
}: EventPageClientWrapperProps) {
  const [activeRole, setActiveRole] = useState<EventRole>(userRole);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleRoleChange = (role: EventRole) => {
    setActiveRole(role);
  };

  const handleCancelRegistration = async () => {
    if (isLoading) return;

    const confirmCancel = window.confirm(
      "Are you sure you want to cancel your registration for this event? This action cannot be undone."
    );

    if (!confirmCancel) return;

    try {
      setIsLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to cancel registration",
          variant: "destructive",
        });
        return;
      }

      const userId = session.user.id;

      const { error: deleteError } = await supabase
        .from("user_event_roles")
        .delete()
        .eq("user_id", userId)
        .eq("event_id", eventId);

      if (deleteError) {
        toast({
          title: "Error",
          description: "Failed to cancel registration. Please try again.",
          variant: "destructive",
        });
        console.error("Error removing user role:", deleteError.message);
        return;
      }

      toast({
        title: "Registration Cancelled",
        description: "You have successfully cancelled your event registration.",
      });

      router.refresh();
    } catch (error) {
      console.error("Error canceling registration:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <RoleBanner
        actualRole={userRole}
        activeRole={activeRole}
        onRoleChange={handleRoleChange}
        eventType="event"
        onCancelRegistration={handleCancelRegistration}
        eventRoleLabels={eventRoleLabels}
      />
      <EventPageHeader
        eventName={eventName}
        eventBlurb={eventBlurb}
        eventDate={eventDate}
        location={location}
        coverImageUrl={coverImageUrl}
        eventId={displayEventId}
        hasJoined={hasJoined}
        userRole={userRole}
        onManageEventClick={() => handleRoleChange("organizer")}
      />
    </>
  );
}
