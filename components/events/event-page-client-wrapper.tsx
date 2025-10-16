"use client";

import { useState, ReactNode } from "react";
import { EventRole } from "@/lib/types";
import { RoleBanner } from "./role-banner";
import { EventPageHeader } from "./event-page-header";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/hooks/use-toast";
import { OrganizerEditOverview } from "./organizer-edit-overview";

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
  tabsAndContent: ReactNode; // The tabs and main content to show for non-organizer roles
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
  tabsAndContent,
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

  // Show organizer dashboard when viewing as organizer/admin
  if (activeRole === EventRole.Organizer || activeRole === EventRole.Admin) {
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
        <OrganizerEditOverview eventId={eventId} />
      </>
    );
  }

  // Show regular event page for other roles
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
        onManageEventClick={() => handleRoleChange(EventRole.Organizer)}
      />
      {tabsAndContent}
    </>
  );
}
