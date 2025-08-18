"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ERROR_MESSAGES } from "@/lib/config/constants";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";

const EventRegistrationContext =
  createContext<EventRegistrationContextType | null>(null);

export function useEventRegistration() {
  const context = useContext(EventRegistrationContext);
  if (!context) {
    throw new Error(ERROR_MESSAGES.REGISTRATION_CONTEXT);
  }
  return context;
}

export interface EventRegistrationContextType {
  isRegistered: boolean;
  setIsRegistered: (value: boolean) => void;
  userRole: EventRole | null; // The user's actual assigned role
  setUserRole: (value: EventRole | null) => void;
  activeRole: EventRole | null; // The currently active role for dashboard view
  switchRole: (role: EventRole) => void; // Function to switch active role
  canSwitchToRole: (role: EventRole) => boolean; // Check if user can switch to role
  roleLabels: Record<string, string> | null;
  isLoading: boolean; // Whether the registration check is still in progress
}

export interface EventRegistrationProviderProps {
  eventId: string;
  children: React.ReactNode;
}

export function EventRegistrationProvider({
  eventId,
  children,
}: EventRegistrationProviderProps) {
  const [isRegistered, setIsRegistered] = useState(false);
  const [userRole, setUserRole] = useState<EventRole | null>(null);
  const [activeRole, setActiveRole] = useState<EventRole | null>(null);
  const [roleLabels, setRoleLabels] = useState<Record<string, string> | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkRegistrationStatus() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setIsLoading(false);
          return;
        }

        const userId = session.user.id;

        // Fetch event details including role_labels
        const { data: eventData } = await supabase
          .from("events")
          .select("role_labels")
          .eq("event_id", eventId)
          .single();

        if (eventData?.role_labels) {
          setRoleLabels(eventData.role_labels);
        }

        // Check user_event_roles table for role
        const { data: roleData } = await supabase
          .from("user_event_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("event_id", eventId)
          .maybeSingle();


        if (roleData) {
          setIsRegistered(true);
          setUserRole(roleData.role as EventRole);
          setActiveRole(roleData.role as EventRole); // Initially, active role is the same as user role
        } else {
          setIsRegistered(false);
          setUserRole(null);
          setActiveRole(null);
        }
      } catch (error) {
        console.error(ERROR_MESSAGES.REGISTRATION_STATUS, error);
      } finally {
        setIsLoading(false);
      }
    }

    checkRegistrationStatus();
  }, [eventId]);

  // Role switching functions
  const switchRole = (role: EventRole) => {
    if (userRole && canAccessRole(userRole, role)) {
      setActiveRole(role);
    }
  };

  const canSwitchToRole = (role: EventRole): boolean => {
    if (!userRole) return false;
    return canAccessRole(userRole, role);
  };

  return (
    <EventRegistrationContext.Provider
      value={{
        isRegistered,
        setIsRegistered,
        userRole,
        setUserRole,
        activeRole,
        switchRole,
        canSwitchToRole,
        roleLabels,
        isLoading,
      }}
    >
      {children}
    </EventRegistrationContext.Provider>
  );
}
