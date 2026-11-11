"use client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export function needsSoloConfirmation(teammates: string[], participants: { email: string }[]) {
  return participants.length > 0 && !teammates.some(email => participants.some(person => person.email.toLowerCase() === email.toLowerCase()));
}

export function SoloSubmissionConfirmation({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
 return <AlertDialog open={open} onOpenChange={onOpenChange}>
  <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Submitting solo?</AlertDialogTitle>
   <AlertDialogDescription>You haven&apos;t added any teammates. If you built this with others, add them now so they get credit. Teammates must be registered for this event to appear in the picker.</AlertDialogDescription>
  </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Add teammates</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>Submit solo</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
 </AlertDialog>;
}
