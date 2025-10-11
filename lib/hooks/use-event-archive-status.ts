"use client";

import { EventDetails, EventVisibility } from "@/lib/types";
import { toast } from "@/lib/hooks/use-toast";

export function useEventArchiveStatus(event: EventDetails | null) {
  const isArchived = event?.visibility === EventVisibility.Archived;

  const checkArchiveStatus = (actionName: string = "edit this event"): boolean => {
    if (isArchived) {
      toast({
        title: "Cannot Edit Archived Event",
        description: `This event is archived and cannot be edited. To ${actionName}, please unarchive the event first.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  return {
    isArchived,
    checkArchiveStatus,
  };
}
