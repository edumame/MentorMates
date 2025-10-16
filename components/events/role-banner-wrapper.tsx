"use client";

import { useState } from "react";
import { RoleBanner } from "./role-banner";
import { EventRole } from "@/lib/types";

interface RoleBannerWrapperProps {
  userRole: EventRole;
  eventRoleLabels?: Record<string, string> | null;
}

export function RoleBannerWrapper({ userRole, eventRoleLabels }: RoleBannerWrapperProps) {
  const [activeRole, setActiveRole] = useState<EventRole>(userRole);

  const handleRoleChange = (role: EventRole) => {
    setActiveRole(role);
    // TODO: In the future, we could store this in localStorage or URL params
    // to persist the selected view across page navigation
  };

  const handleCancelRegistration = () => {
    // TODO: Implement cancel registration logic
    console.log("Cancel registration clicked");
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
