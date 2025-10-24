"use client";

import { useState, ReactNode, useEffect } from "react";
import { EventRole } from "@/lib/types";
import { RoleBanner } from "./role-banner";
import { EventPageHeader } from "./event-page-header";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/hooks/use-toast";
import { OrganizerEditOverview } from "./organizer-edit-overview";
import { useActiveRole } from "./ActiveRoleContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  paid: boolean;
  eventType: string;
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
  hasJoined,
  paid,
  tabsAndContent,
  eventType,
}: EventPageClientWrapperProps) {
  const { activeRole, setActiveRole } = useActiveRole();
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Initialize activeRole with userRole
  useEffect(() => {
    if (!activeRole) {
      setActiveRole(userRole);
    }
  }, [userRole, activeRole, setActiveRole]);

  // Track showCancelDialog changes
  useEffect(() => {
    // Dialog state tracking
  }, [showCancelDialog]);

  const handleRoleChange = (role: EventRole) => {
    setActiveRole(role);
  };

  const handleCancelRegistration = () => {
    setShowCancelDialog(true);
  };

  const confirmCancelRegistration = async () => {
    if (isLoading) return;

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

      setShowCancelDialog(false);
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
  const currentRole = activeRole || userRole;
  if (currentRole === EventRole.Organizer || currentRole === EventRole.Admin) {
    return (
      <>
        <RoleBanner
          actualRole={userRole}
          activeRole={currentRole}
          onRoleChange={handleRoleChange}
          eventType="event"
          onCancelRegistration={handleCancelRegistration}
          eventRoleLabels={eventRoleLabels}
        />
        <OrganizerEditOverview eventId={eventId} />

        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Event Registration</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel your registration for this event? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmCancelRegistration}
                disabled={isLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isLoading ? "Cancelling..." : "Yes, cancel registration"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Show regular event page for other roles
  return (
    <>
      <RoleBanner
        actualRole={userRole}
        activeRole={currentRole}
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
        eventId={eventId}
        hasJoined={hasJoined}
        userRole={userRole}
        activeRole={currentRole}
        onManageEventClick={() => handleRoleChange(EventRole.Organizer)}
        paid={paid}
        eventType={eventType}
      />
      {tabsAndContent}

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Event Registration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your registration for this event? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancelRegistration}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? "Cancelling..." : "Yes, cancel registration"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
