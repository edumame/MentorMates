"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/lib/hooks/use-toast";
import { createClient } from "@/app/utils/supabase/client";
import type { MentorAvailabilityWithBookings } from "@/lib/types/mentor-booking";

export default function MentorBookingPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id ?? "";
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
      const res = await fetch(
        `/api/events/${eventId}/mentor-availability`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setSlots(data.availability ?? []);
    } catch (e) {
      toast({
        title: "Could not load slots",
        description: e instanceof Error ? e.message : "Unknown error",
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
    const map = new Map<
      string,
      { mentorName: string; rows: MentorAvailabilityWithBookings[] }
    >();
    for (const s of slots) {
      if (userId && s.mentor_id === userId) continue; // don't show own slots to self
      const key = s.mentor_id;
      const label =
        s.mentor?.display_name ||
        s.mentor?.email ||
        "Mentor";
      if (!map.has(key)) {
        map.set(key, { mentorName: label, rows: [] });
      }
      map.get(key)!.rows.push(s);
    }
    return Array.from(map.entries()).map(([mentorId, v]) => ({
      mentorId,
      mentorName: v.mentorName,
      rows: v.rows,
    }));
  }, [slots, userId]);

  async function handleBook(slot: MentorAvailabilityWithBookings) {
    setBusyId(slot.id);
    try {
      const res = await fetch(`/api/events/${eventId}/mentor-bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability_id: slot.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to book");
      toast({ title: "Booked!" });
      await load();
    } catch (e) {
      toast({
        title: "Could not book slot",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(bookingId: string) {
    setBusyId(bookingId);
    try {
      const res = await fetch(
        `/api/events/${eventId}/mentor-bookings?id=${bookingId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel");
      toast({ title: "Booking cancelled" });
      await load();
    } catch (e) {
      toast({
        title: "Could not cancel booking",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Book a mentor</h1>
        <p className="text-sm text-muted-foreground">
          Choose an open time with one of this event&apos;s mentors.
        </p>
      </div>

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
                {group.rows.map((s) => {
                  const remaining = s.max_bookings - s.booking_count;
                  const viewerBooked = Boolean(s.viewer_booking_id);
                  const full = remaining <= 0;
                  return (
                    <Card
                      key={s.id}
                      className="p-4 flex items-center justify-between gap-4"
                    >
                      <div className="text-sm">
                        <div className="font-medium">
                          {new Date(s.start_time).toLocaleString()}{" "}
                          <span className="text-muted-foreground">→</span>{" "}
                          {new Date(s.end_time).toLocaleString()}
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
                          disabled={busyId === s.viewer_booking_id}
                          onClick={() =>
                            s.viewer_booking_id &&
                            handleCancel(s.viewer_booking_id)
                          }
                        >
                          Cancel
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={full || busyId === s.id}
                          onClick={() => handleBook(s)}
                        >
                          {busyId === s.id ? "Booking..." : "Book"}
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
