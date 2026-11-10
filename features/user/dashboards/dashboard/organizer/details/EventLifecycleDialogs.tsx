"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { ApprovalStatus, EventVisibility } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

/**
 * Archive/unarchive and delete dialogs shared by the Manage Event header
 * (components/events/organizer-edit-overview.tsx) and the Basics tab danger
 * zone (BasicInfoTab.tsx), so both entry points have the same copy, the same
 * typed confirmation and the same error handling.
 */

interface LifecycleEvent {
  event_id: string;
  event_name: string;
  visibility?: EventVisibility | string | null;
}

type TriggerRenderer = (state: { busy: boolean; isArchived: boolean }) => ReactNode;

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof body?.error === "string" && body.error ? body.error : fallback;
}

interface ArchiveEventDialogProps {
  event: LifecycleEvent;
  /** Renders the trigger; must be a single element accepting a ref (e.g. Button). */
  trigger: TriggerRenderer;
  /**
   * Archiving withdraws a pending submission, so the route also returns the
   * resulting approval status; store it so the badge matches the database.
   */
  onVisibilityChange: (
    visibility: EventVisibility,
    approvalStatus?: ApprovalStatus
  ) => void;
  onBusyChange?: (busy: boolean) => void;
}

export function ArchiveEventDialog({
  event,
  trigger,
  onVisibilityChange,
  onBusyChange,
}: ArchiveEventDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusyState] = useState(false);
  const isArchived = event.visibility === EventVisibility.Archived;

  const setBusy = (value: boolean) => {
    setBusyState(value);
    onBusyChange?.(value);
  };

  const handleToggle = async () => {
    const action = isArchived ? "unarchive" : "archive";
    try {
      setBusy(true);
      const res = await fetch(`/api/events/${event.event_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        throw new Error(await readError(res, `Failed to ${action} event`));
      }
      const result = await res.json();
      onVisibilityChange(
        result.newVisibility as EventVisibility,
        (result.approvalStatus ?? undefined) as ApprovalStatus | undefined
      );
      toast({ title: "Success", description: `Event ${action}d successfully` });
      router.refresh();
    } catch (error) {
      console.error(`Error trying to ${action} event:`, error);
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger({ busy, isArchived })}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isArchived ? "Unarchive this event?" : "Archive this event?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isArchived
              ? "This will make the event editable again and change its visibility to private. You can change the visibility afterwards if needed."
              : "Archived events are hidden from non-organizers and the public, and cannot be edited by organizers. You can unarchive it later if needed."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleToggle}>
            {isArchived ? "Confirm Unarchive" : "Confirm Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteEventDialogProps {
  event: LifecycleEvent;
  trigger: TriggerRenderer;
  onBusyChange?: (busy: boolean) => void;
}

interface AffectedCounts {
  people: number | null;
  projects: number | null;
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function DeleteEventDialog({ event, trigger, onBusyChange }: DeleteEventDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusyState] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [counts, setCounts] = useState<AffectedCounts>({ people: null, projects: null });
  const isArchived = event.visibility === EventVisibility.Archived;
  const confirmed = confirmText.trim() === event.event_name.trim();

  const setBusy = (value: boolean) => {
    setBusyState(value);
    onBusyChange?.(value);
  };

  const loadCounts = async () => {
    const [people, projects] = await Promise.all([
      supabase
        .from("user_event_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("event_id", event.event_id),
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.event_id),
    ]);
    setCounts({
      people: typeof people?.count === "number" ? people.count : null,
      projects: typeof projects?.count === "number" ? projects.count : null,
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      void loadCounts().catch((error) => {
        console.error("Error loading delete impact counts:", error);
      });
    } else {
      setConfirmText("");
    }
  };

  const handleDelete = async () => {
    if (!confirmed) return;
    try {
      setBusy(true);
      const res = await fetch(`/api/events/${event.event_id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(await readError(res, "Failed to delete event"));
      }
      toast({ title: "Event deleted" });
      router.push("/events");
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const peopleText =
    counts.people === null ? "registrations and roles" : `registrations and roles (${pluralize(counts.people, "person", "people")})`;
  const projectsText =
    counts.projects === null ? "their projects" : `their ${pluralize(counts.projects, "project", "projects")}`;

  return (
    <AlertDialog onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>{trigger({ busy, isArchived })}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this event?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the event and everything attached to it: {peopleText},
            tickets, forms and responses, teams, tracks, prizes, judge scores and mentor
            feedback. Participants keep {projectsText}, but they will no longer belong to any
            event. Events with payments cannot be deleted; archive them instead. This cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label htmlFor={`delete-event-confirm-${event.event_id}`} className="text-sm font-medium text-black">
            Type <span className="font-semibold">{event.event_name}</span> to confirm
          </label>
          <Input
            id={`delete-event-confirm-${event.event_id}`}
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={busy || !confirmed}
            onClick={handleDelete}
          >
            Confirm Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
