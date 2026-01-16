"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/use-toast";
import { EventRole, EventVisibility, EventDetails } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { getRoleLabel } from "@/features/user/roles/roles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PasswordTabProps {
  eventId: string;
  roleLabels?: Record<string, string> | null;
  isArchived: boolean;
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
}

export function PasswordTab({ eventId, roleLabels, isArchived, event, setEvent }: PasswordTabProps) {
  const [rolePasswords, setRolePasswords] = useState<Record<EventRole, string>>(
    {} as Record<EventRole, string>
  );
  const [isLoading, setIsLoading] = useState(false);
  const [visibility, setVisibility] = useState<EventVisibility | null>(
    event?.visibility || null
  );
  const { toast } = useToast();

  // List of available roles from the EventRole enum, excluding Admin
  const availableRoles = [
    EventRole.Participant,
    EventRole.Mentor,
    EventRole.Judge,
    EventRole.Organizer
  ] as EventRole[];

  // Update visibility when event prop changes
  useEffect(() => {
    if (event?.visibility) {
      setVisibility(event.visibility);
    }
  }, [event?.visibility]);

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

  const handleVisibilityChange = async (value: EventVisibility) => {
    try {
      setIsLoading(true);

      const { error } = await supabase
        .from("events")
        .update({ visibility: value })
        .eq("event_id", eventId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update event visibility",
          variant: "destructive",
        });
        return;
      }

      setVisibility(value);

      // Update parent component's event state
      setEvent((prev) => {
        if (!prev) return prev;
        return { ...prev, visibility: value };
      });

      toast({
        title: "Success",
        description: "Event visibility updated successfully",
      });
    } catch (error) {
      console.error("Error updating event visibility:", error);
      toast({
        title: "Error",
        description: "Failed to update event visibility",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="space-y-4 p-4 border rounded-lg bg-card">
        <h3 className="text-lg font-semibold">Event Visibility</h3>
        <div className="space-y-2">
          <label className="text-sm font-medium">Event Visibility</label>
          <Select
            value={visibility || ""}
            onValueChange={(value) =>
              handleVisibilityChange(value as EventVisibility)
            }
            disabled={isArchived}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EventVisibility.Private}>
                Private
              </SelectItem>
              <SelectItem value={EventVisibility.Draft}>Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4 p-4 border rounded-lg bg-card">
        <h3 className="text-lg font-semibold">Role Passwords</h3>
        <div className="space-y-4">
          {availableRoles.map((role) => {
            const label = getRoleLabel(role, roleLabels);
            return (
              <div key={role} className="space-y-2">
                <label className="text-sm font-medium">
                  {label} Password
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={rolePasswords[role] || ""}
                    onChange={(e) => handlePasswordChange(role, e.target.value)}
                    placeholder={`Set ${label.toLowerCase()} password`}
                    disabled={isArchived}
                  />
                  <Button
                    onClick={() => handleSetPassword(role)}
                    disabled={isLoading || !rolePasswords[role] || isArchived}
                  >
                    Save
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  This password will be used by {label.toLowerCase()}s to join the event.
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
