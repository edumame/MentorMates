"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/lib/hooks/use-toast";
import { createClient } from "@/app/utils/supabase/client";
import { cn } from "@/lib/utils";
import type { MentorAvailabilityWithBookings } from "@/lib/types/mentor-booking";
import { defaultSlotWindow, formatSlotRange } from "./utils";

function padDateTimePart(value: number): string {
  return value.toString().padStart(2, "0");
}

function toInputValue(value: string): string {
  const date = new Date(value);

  return [
    date.getFullYear(),
    padDateTimePart(date.getMonth() + 1),
    padDateTimePart(date.getDate()),
  ].join("-") +
    "T" +
    [
      padDateTimePart(date.getHours()),
      padDateTimePart(date.getMinutes()),
    ].join(":");
}

function fromInputValue(value: string): string {
  // datetime-local is local time without TZ; reattach the browser TZ to get ISO.
  return new Date(value).toISOString();
}

async function getSubmissionWindowDefaults(eventId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .select("submission_time_start, submission_time_cutoff")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  // A one-hour slot at the next full hour (or the window start), not the
  // whole multi-day submission window (MENT-003).
  const suggested = defaultSlotWindow({
    start: data?.submission_time_start,
    end: data?.submission_time_cutoff,
  });
  return {
    start: toInputValue(suggested.start.toISOString()),
    end: toInputValue(suggested.end.toISOString()),
    fromEventWindow: Boolean(data?.submission_time_start),
  };
}

interface MentorAvailabilityManagerProps {
  eventId: string;
  className?: string;
  showHeader?: boolean;
}

export function MentorAvailabilityManager({
  eventId,
  className,
  showHeader = true,
}: MentorAvailabilityManagerProps) {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [slots, setSlots] = useState<MentorAvailabilityWithBookings[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [maxBookings, setMaxBookings] = useState(1);
  const [usingSubmissionWindowDefaults, setUsingSubmissionWindowDefaults] =
    useState(false);
  const [slotToDelete, setSlotToDelete] =
    useState<MentorAvailabilityWithBookings | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDefaultWindow() {
      try {
        const defaults = await getSubmissionWindowDefaults(eventId);
        if (cancelled) {
          return;
        }

        setStart((currentStart) => currentStart || defaults.start);
        setEnd((currentEnd) => currentEnd || defaults.end);
        setUsingSubmissionWindowDefaults(defaults.fromEventWindow);
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading submission window:", error);
        }
        return;
      }
    }

    if (eventId) {
      loadDefaultWindow();
    }

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const load = useCallback(async () => {
    if (!eventId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/mentor-availability`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load");
      }

      setSlots(data.availability ?? []);
    } catch (error) {
      toast({
        title: "Could not load availability",
        description:
          error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const ownSlots = useMemo(() => {
    if (!userId) return [];

    return slots.filter((slot) => slot.mentor_id === userId);
  }, [slots, userId]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();

    if (!start || !end) {
      toast({ title: "Pick a start and end time", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/mentor-availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: fromInputValue(start),
          end_time: fromInputValue(end),
          max_bookings: maxBookings,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create");
      }

      toast({ title: "Slot added" });
      const defaults = await getSubmissionWindowDefaults(eventId);
      setStart(defaults.start);
      setEnd(defaults.end);
      setMaxBookings(1);
      await load();
    } catch (error) {
      toast({
        title: "Could not create slot",
        description:
          error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteSlot() {
    if (!slotToDelete) {
      return;
    }

    const { id, booking_count: bookingCount } = slotToDelete;
    setDeleting(true);
    try {
      // The user has seen the booking count in the dialog, so confirm the
      // cancellation explicitly; the API refuses booked slots otherwise.
      const res = await fetch(
        `/api/events/${eventId}/mentor-availability?id=${id}${bookingCount > 0 ? "&force=true" : ""}`,
        { method: "DELETE" }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete");
      }

      toast({ title: "Slot deleted" });
      setSlotToDelete(null);
      await load();
    } catch (error) {
      toast({
        title: "Could not delete slot",
        description:
          error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function cancelBooking(bookingId: string) {
    setCancellingId(bookingId);
    try {
      const res = await fetch(
        `/api/events/${eventId}/mentor-bookings?id=${bookingId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel booking");
      }
      toast({ title: "Booking cancelled" });
      await load();
    } catch (error) {
      toast({
        title: "Could not cancel booking",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {showHeader && (
        <div>
          <h1 className="text-2xl font-semibold">My mentor availability</h1>
          <p className="text-sm text-muted-foreground">
            Add time windows when participants can book a session with you.
          </p>
        </div>
      )}

      <Card className="p-4">
        <form onSubmit={handleCreate} className="space-y-4">
          {usingSubmissionWindowDefaults && (
            <p className="text-sm text-muted-foreground">
              Suggested a one-hour slot during the hackathon. Add several
              shorter slots rather than one long one so more teams can book.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="start">Start</Label>
              <Input
                id="start"
                type="datetime-local"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end">End</Label>
              <Input
                id="end"
                type="datetime-local"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="max-w-xs space-y-1">
            <Label htmlFor="max">Max bookings</Label>
            <Input
              id="max"
              type="number"
              min={1}
              max={50}
              value={maxBookings}
              onChange={(event) =>
                setMaxBookings(Math.max(1, Number(event.target.value) || 1))
              }
            />
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add slot"}
          </Button>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-medium">Your slots</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : ownSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No slots yet. Add your first above.
          </p>
        ) : (
          <div className="space-y-3">
            {ownSlots.map((slot) => (
              <Card
                key={slot.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div className="text-sm">
                  <div className="font-medium">
                    {formatSlotRange(slot.start_time, slot.end_time)}
                  </div>
                  <div className="text-muted-foreground">
                    {slot.booking_count} / {slot.max_bookings} booked
                  </div>

                  {slot.participants.length > 0 && (
                    <ul className="mt-1 space-y-1 text-muted-foreground">
                      {slot.participants.map((participant) => (
                        <li
                          key={participant.booking_id ?? participant.email ?? participant.display_name}
                          className="flex items-center gap-2"
                        >
                          <span>
                            {participant.display_name?.trim() || participant.email || "Participant"}
                          </span>
                          {participant.booking_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              disabled={cancellingId === participant.booking_id}
                              onClick={() => void cancelBooking(participant.booking_id!)}
                            >
                              {cancellingId === participant.booking_id ? "Cancelling..." : "Cancel booking"}
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setSlotToDelete(slot)}
                >
                  Delete
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={slotToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setSlotToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this slot?</AlertDialogTitle>
            <AlertDialogDescription>
              {slotToDelete && slotToDelete.booking_count > 0
                ? `${slotToDelete.booking_count} participant${slotToDelete.booking_count === 1 ? " has" : "s have"} booked this slot. Their booking${slotToDelete.booking_count === 1 ? "" : "s"} will be cancelled. This cannot be undone.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteSlot();
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
