"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { useArchiveEvent } from "@/lib/hooks/use-archive-event";
import { EventVisibility } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/lib/hooks/use-toast";

interface ArchiveEventButtonProps {
  eventId: string;
  eventName: string;
  currentVisibility: EventVisibility;
  onArchiveStatusChange?: (newVisibility: EventVisibility) => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

export function ArchiveEventButton({
  eventId,
  eventName,
  currentVisibility,
  onArchiveStatusChange,
  variant = "outline",
  size = "sm",
}: ArchiveEventButtonProps) {
  const { isLoading, error, archiveEvent, unarchiveEvent } = useArchiveEvent();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const isArchived = currentVisibility === EventVisibility.Archived;

  const handleArchiveAction = async () => {
    const success = isArchived 
      ? await unarchiveEvent(eventId)
      : await archiveEvent(eventId);

    if (success) {
      const newVisibility = isArchived 
        ? EventVisibility.Public 
        : EventVisibility.Archived;
      
      onArchiveStatusChange?.(newVisibility);
      
      toast({
        title: isArchived ? "Event Unarchived" : "Event Archived",
        description: isArchived 
          ? `${eventName} has been restored and is now visible.`
          : `${eventName} has been archived and is now read-only.`,
      });
    } else {
      toast({
        title: "Error",
        description: error || `Failed to ${isArchived ? "unarchive" : "archive"} event`,
        variant: "destructive",
      });
    }
    
    setIsDialogOpen(false);
  };

  return (
    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={isLoading}
          className={isArchived ? "text-blue-600 hover:text-blue-700" : "text-orange-600 hover:text-orange-700"}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : isArchived ? (
            <ArchiveRestore className="h-4 w-4 mr-2" />
          ) : (
            <Archive className="h-4 w-4 mr-2" />
          )}
          {isArchived ? "Unarchive" : "Archive"}
        </Button>
      </AlertDialogTrigger>
      
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isArchived ? "Unarchive Event" : "Archive Event"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isArchived ? (
              <>
                Are you sure you want to unarchive <strong>{eventName}</strong>? 
                This will restore the event and make it visible to users again.
              </>
            ) : (
              <>
                Are you sure you want to archive <strong>{eventName}</strong>? 
                This will make the event read-only and hide it from the main events list. 
                Users will still be able to view archived events in a separate section.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleArchiveAction}
            disabled={isLoading}
            className={isArchived 
              ? "bg-blue-600 hover:bg-blue-700" 
              : "bg-orange-600 hover:bg-orange-700"
            }
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {isArchived ? "Unarchive" : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}