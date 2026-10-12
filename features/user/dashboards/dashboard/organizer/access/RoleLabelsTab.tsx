"use client";

import { useState, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/use-toast";
import { EventRole } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { DEFAULT_ROLE_LABELS, getRoleLabel } from "@/features/user/roles/roles";
import { EventDetails } from "@/lib/types";

interface RoleLabelsTabProps {
  eventId: string;
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  isArchived: boolean;
}

export function RoleLabelsTab({
  eventId,
  event,
  setEvent,
  saving,
  setSaving,
  isArchived,
}: RoleLabelsTabProps) {
  const [roleLabels, setRoleLabels] =
    useState<Record<string, string>>(DEFAULT_ROLE_LABELS);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize labels from event if available
    if (event?.role_labels) {
      setRoleLabels({
        ...DEFAULT_ROLE_LABELS,
        ...event.role_labels,
      });
    }
  }, [event]);

  const handleLabelChange = (role: string, label: string) => {
    setRoleLabels((prev) => ({
      ...prev,
      [role]: label,
    }));
  };

  const handleSaveLabels = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from("events")
        .update({ role_labels: roleLabels })
        .eq("event_id", eventId);

      if (error) {
        throw error;
      }

      // Update the event in state to reflect changes
      setEvent({
        ...event,
        role_labels: roleLabels,
      });

      toast({
        title: "Success",
        description: "Role labels updated successfully",
      });
    } catch (error) {
      console.error("Error updating role labels:", error);
      toast({
        title: "Error",
        description: "Failed to update role labels",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setRoleLabels(DEFAULT_ROLE_LABELS);
  };

  const roleDotColor: Record<string, string> = {
    [EventRole.Participant]: "bg-blue-500",
    [EventRole.Judge]: "bg-orange-500",
    [EventRole.Mentor]: "bg-rose-600",
    [EventRole.Organizer]: "bg-teal-600",
  };

  return (
    <div className="flex flex-col">
      <div className="space-y-6 p-5 rounded-[var(--Radius-Large,16px)] bg-card border border-[var(--Opacity-Neutral-Darkest-15,rgba(0,0,0,0.15))]">
        <h3
          className="font-geist font-semibold leading-[140%] text-[var(--Color-Scheme-1-Text,#000)]"
          style={{
            fontSize: "var(--Text-Sizes-Heading-6, 22px)",
            letterSpacing: "-1.32px",
          }}
        >
          Customize Role Labels
        </h3>
        <p className="text-sm text-gray-500">
          Customize how roles are labeled throughout the platform. For example,
          you can change &quot;Judge&quot; to &quot;Investor&quot; for a demo
          day event.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[EventRole.Participant, EventRole.Mentor, EventRole.Judge, EventRole.Organizer]
            .map((role) => (
              <div key={role} className="space-y-2">
                <label className="text-sm font-medium" htmlFor={`role-${role}`}>
                  {getRoleLabel(role)} Label
                </label>
                <div
                  className={`flex items-center gap-2 rounded-[12px] border border-input bg-background px-3 py-2 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${isArchived ? "opacity-60" : ""}`}
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${roleDotColor[role] ?? "bg-gray-400"}`}
                  />
                  <Input
                    id={`role-${role}`}
                    value={roleLabels[role.toString()] ?? ""}
                    onChange={(e) => handleLabelChange(role.toString(), e.target.value)}
                    placeholder={`Custom label for ${getRoleLabel(role)}`}
                    disabled={isArchived}
                    className="flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none h-auto min-h-0"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Default: {getRoleLabel(role)}
                </p>
              </div>
            ))}
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            variant="defaultGray"
            className="gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium"
            onClick={resetToDefaults}
            disabled={saving || isArchived}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset to Defaults</span>
          </Button>
          <Button onClick={handleSaveLabels} disabled={saving || isArchived}>
            {saving ? "Saving..." : "Save Labels"}
          </Button>
        </div>

        <div className="rounded-[12px] bg-blue-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1 md:flex md:justify-between">
              <p className="text-sm text-blue-700">
                Demo Day Example: Participant → Founder, Judge → Investor,
                Mentor → Observer
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
