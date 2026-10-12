"use client";

import { useState } from "react";
import { useToast } from "@/lib/hooks/use-toast";
import { EventDetails } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface ApprovalSettingsTabProps {
  eventId: string;
  event: EventDetails;
  setEvent: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  isArchived: boolean;
}

export function ApprovalSettingsTab({
  eventId,
  event,
  setEvent,
  isArchived,
}: ApprovalSettingsTabProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [requireApproval, setRequireApproval] = useState(
    event?.require_participant_approval || false
  );
  const { toast } = useToast();

  const handleToggleApproval = async (checked: boolean) => {
    try {
      setIsLoading(true);

      const { error } = await supabase
        .from("events")
        .update({ require_participant_approval: checked })
        .eq("event_id", eventId);

      if (error) {
        throw error;
      }

      setRequireApproval(checked);

      // Update parent component's event state
      setEvent((prev) => {
        if (!prev) return prev;
        return { ...prev, require_participant_approval: checked };
      });

      toast({
        title: "Settings Updated",
        description: checked
          ? "Participants will now need approval to join this event."
          : "Participants can now join this event directly.",
      });
    } catch (error) {
      console.error("Error updating approval setting:", error);
      toast({
        title: "Error",
        description: "Failed to update approval settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 p-4 border rounded-[16px] bg-card">
        <h3 className="text-lg font-semibold">Participant Approval</h3>
        <p className="text-sm text-muted-foreground">
          Control whether participants need organizer approval before they can
          join this event.
        </p>

        <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="require-approval" className="text-base">
              Require Participant Approval
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, participants must submit a request and wait for
              organizer approval before joining.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            <Switch
              id="require-approval"
              checked={requireApproval}
              onCheckedChange={handleToggleApproval}
              disabled={isLoading || isArchived}
            />
          </div>
        </div>

        {requireApproval && (
          <div className="rounded-lg bg-muted p-4 mt-4">
            <h4 className="font-medium mb-2">How it works:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                Participants will see a &quot;Request to Join&quot; button
                instead of joining directly
              </li>
              <li>
                You&apos;ll receive their requests in the &quot;Approval
                Requests&quot; tab
              </li>
              <li>
                Approve or reject requests individually with optional feedback
              </li>
              <li>
                Approved participants are automatically added to the event
              </li>
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4 p-4 border rounded-[16px] bg-card opacity-60">
        <h3 className="text-lg font-semibold">
          Per-Role Approval{" "}
          <span className="text-sm font-normal text-muted-foreground">
            (Coming Soon)
          </span>
        </h3>
        <p className="text-sm text-muted-foreground">
          In a future update, you&apos;ll be able to configure approval
          requirements for each role individually (Mentor, Judge, etc.).
        </p>
      </div>

      <div className="space-y-4 p-4 border rounded-[16px] bg-card">
        <h3 className="text-lg font-semibold">Registration Questionnaire</h3>
        <p className="text-sm text-muted-foreground">
          Questionnaire requirement is now automatic: participants must complete
          it only when a published <strong>Registration Intake Form</strong>{" "}
          exists under Forms → Application form. Deleting/unpublishing that form
          removes the requirement.
        </p>
      </div>
    </div>
  );
}
