"use client";

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

interface LeadRemovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  memberCount: number;
  // Says why this action dissolves the team, from the caller's point of view.
  reason: string;
  onConfirm: () => void;
}

// The teams API dissolves a team when its lead is removed, so both the lead's
// Leave and an organizer's remove must confirm that outcome first.
export function LeadRemovalDialog({
  open,
  onOpenChange,
  teamName,
  memberCount,
  reason,
  onConfirm,
}: LeadRemovalDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dissolve {teamName}?</AlertDialogTitle>
          <AlertDialogDescription>
            {reason}{" "}
            {memberCount > 1
              ? `All ${memberCount} members will lose this team and any project link.`
              : "The team and any project link will be removed."}{" "}
            The project itself is not deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Dissolve team
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
