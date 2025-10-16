"use client";

import { useState } from "react";
import { RoleBanner } from "./role-banner";
import { EventRole } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/hooks/use-toast";

interface RoleBannerWrapperProps {
  userRole: EventRole;
  eventId: string;
  eventRoleLabels?: Record<string, string> | null;
}

export function RoleBannerWrapper({ userRole, eventId, eventRoleLabels }: RoleBannerWrapperProps) {
  const [activeRole, setActiveRole] = useState<EventRole>(userRole);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleRoleChange = (role: EventRole) => {
    setActiveRole(role);
    // TODO: In the future, we could store this in localStorage or URL params
    // to persist the selected view across page navigation
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

      // Delete from user_event_roles
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

      // Refresh the page to update UI
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
    <RoleBanner
      actualRole={userRole}
      activeRole={activeRole}
      onRoleChange={handleRoleChange}
      eventType="event"
      onCancelRegistration={handleCancelRegistration}
      eventRoleLabels={eventRoleLabels}
    />
  );
}
