"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/use-toast";
import { EventRole, EventDetails } from "@/lib/types";
import { getRoleLabel } from "@/features/user/roles/roles";

interface PasswordTabProps {
  eventId: string;
  roleLabels?: Record<string, string> | null;
  isArchived: boolean;
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
}

export function PasswordTab({
  eventId,
  roleLabels,
  isArchived,
  event,
  setEvent,
}: PasswordTabProps) {
  const [rolePasswords, setRolePasswords] = useState<Record<EventRole, string>>(
    {} as Record<EventRole, string>
  );
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // List of available roles from the EventRole enum, excluding Admin
  const availableRoles = [
    EventRole.Participant,
    EventRole.Mentor,
    EventRole.Judge,
    EventRole.Organizer,
  ] as EventRole[];

  const handlePasswordChange = (role: EventRole, password: string) => {
    setRolePasswords((prev) => ({
      ...prev,
      [role]: password,
    }));
  };

  const handleSetPassword = async (role: EventRole) => {
    try {
      setIsLoading(true);
      const password = rolePasswords[role] || "";

      const response = await fetch("/api/roles/set-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          role,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        toast({
          title: "Error",
          description: data.error || "Failed to set password",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: `${role} password updated successfully`,
      });

      // Clear password input
      handlePasswordChange(role, "");
    } catch (error) {
      console.error("Error setting password:", error);
      toast({
        title: "Error",
        description: "Failed to set password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Two-column grid order: left = Participant, Judge; right = Mentor, Organizer
  const leftColumnRoles = [EventRole.Participant, EventRole.Judge];
  const rightColumnRoles = [EventRole.Mentor, EventRole.Organizer];

  const renderRoleField = (role: EventRole) => {
    const label = getRoleLabel(role, roleLabels);
    return (
      <div key={role} className="space-y-2">
        <label className="text-sm font-medium text-[var(--Color-Scheme-1-Text,#000)]">
          {label} Password
        </label>
        <div className="flex gap-2">
          <Input
            type="password"
            value={rolePasswords[role] || ""}
            onChange={(e) => handlePasswordChange(role, e.target.value)}
            placeholder={`Set ${label.toLowerCase()} password`}
            disabled={isArchived}
            className="flex-1 min-w-0"
          />
          <Button
            onClick={() => handleSetPassword(role)}
            disabled={isLoading || !rolePasswords[role] || isArchived}
            variant="outline"
            className="shrink-0 bg-[#4B89EF] text-white border border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))] hover:bg-[#3E7EEA] shadow-none [box-shadow:none]"
          >
            Save
          </Button>
        </div>
        <p className="text-xs text-gray-500 italic">
          This password will be used by {label.toLowerCase()}s to join the
          event.
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="space-y-6 p-5 rounded-lg bg-card border border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))]">
        <h3
          className="font-geist font-semibold leading-[140%] text-[var(--Color-Scheme-1-Text,#000)]"
          style={{
            fontSize: "var(--Text-Sizes-Heading-6, 22px)",
            letterSpacing: "-1.32px",
          }}
        >
          Role Passwords
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
          <div className="space-y-6">
            {leftColumnRoles.map(renderRoleField)}
          </div>
          <div className="space-y-6">
            {rightColumnRoles.map(renderRoleField)}
          </div>
        </div>
      </div>
    </div>
  );
}
