"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/lib/hooks/use-toast";
import { createClient } from "@/app/utils/supabase/client";
import { cn } from "@/lib/utils";
import type { MentorAvailabilityWithBookings } from "@/lib/types/mentor-booking";

interface MentorBookingManagerProps {
  eventId: string;
  className?: string;
  showHeader?: boolean;
}

export function MentorBookingManager({
  eventId,
  className,
  showHeader = true,
}: MentorBookingManagerProps) {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [slots, setSlots] = useState<MentorAvailabilityWithBookings[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

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
        title: "Could not load slots",
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

  const grouped = useMemo(() => {
    const groups = new Map<
      string,
      { mentorName: string; rows: MentorAvailabilityWithBookings[] }
    >();

    for (const slot of slots) {

      const mentorName =
        slot.mentor?.display_name || slot.mentor?.email || "Mentor";

      if (!groups.has(slot.mentor_id)) {
        groups.set(slot.mentor_id, { mentorName, rows: [] });
      }

      groups.get(slot.mentor_id)?.rows.push(slot);
    }

    return Array.from(groups.entries()).map(([mentorId, value]) => ({
      mentorId,
      mentorName: value.mentorName,
      rows: value.rows,
    }));
  }, [slots]);

  async function handleBook(slot: MentorAvailabilityWithBookings) {
    setBusyId(slot.id);

    try {
      const res = await fetch(`/api/events/${eventId}/mentor-bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability_id: slot.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to book");
      }

      toast({ title: "Booked!" });
      await load();
    } catch (error) {
      toast({
        title: "Could not book slot",
        description:
          error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(bookingId: string) {
    setBusyId(bookingId);

    try {
      const res = await fetch(`/api/events/${eventId}/mentor-bookings?id=${bookingId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel");
      }

      toast({ title: "Booking cancelled" });
      await load();
    } catch (error) {
      toast({
        title: "Could not cancel booking",
        description:
          error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {showHeader && (
        <div>
          <h1 className="text-2xl font-semibold">Book a mentor</h1>
          <p className="text-sm text-muted-foreground">
            Choose an open time with one of this event&apos;s mentors.
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading slots...</p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No mentor availability has been posted yet.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.mentorId} className="space-y-2">
              <h2 className="text-lg font-medium">{group.mentorName}</h2>

              <div className="space-y-2">
                {group.rows.map((slot) => {
                  const remaining = slot.max_bookings - slot.booking_count;
                  const viewerBooked = Boolean(slot.viewer_booking_id);
                  const full = remaining <= 0;

                  return (
                    <Card
                      key={slot.id}
                      className="flex items-center justify-between gap-4 p-4"
                    >
                      <div className="text-sm">
                        <div className="font-medium">
                          {new Date(slot.start_time).toLocaleString()}{" "}
                          <span className="text-muted-foreground">→</span>{" "}
                          {new Date(slot.end_time).toLocaleString()}
                        </div>
                        <div className="text-muted-foreground">
                          {viewerBooked
                            ? "You are booked"
                            : full
                              ? "Full"
                              : `${remaining} spot${remaining === 1 ? "" : "s"} open`}
                        </div>
                      </div>

                      {viewerBooked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === slot.viewer_booking_id}
                          onClick={() =>
                            slot.viewer_booking_id &&
                            handleCancel(slot.viewer_booking_id)
                          }
                        >
                          Cancel
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={full || busyId === slot.id}
                          onClick={() => handleBook(slot)}
                        >
                          {busyId === slot.id ? "Booking..." : "Book"}
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
