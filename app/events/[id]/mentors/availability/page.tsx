"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/lib/hooks/use-toast";
import { createClient } from "@/app/utils/supabase/client";
import type { MentorAvailabilityWithBookings } from "@/lib/types/mentor-booking";

function fromInputValue(v: string): string {
  // datetime-local is local time without TZ; reattach the browser TZ to get ISO.
  const d = new Date(v);
  return d.toISOString();
}

export default function MentorAvailabilityPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id ?? "";
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [slots, setSlots] = useState<MentorAvailabilityWithBookings[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [maxBookings, setMaxBookings] = useState<number>(1);

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
        title: "Could not load availability",
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

  const ownSlots = useMemo(
    () =>
      userId
        ? slots.filter((s) => s.mentor_id === userId)
        : [],
    [slots, userId]
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!start || !end) {
      toast({ title: "Pick a start and end time", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/mentor-availability`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_time: fromInputValue(start),
            end_time: fromInputValue(end),
            max_bookings: maxBookings,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      toast({ title: "Slot added" });
      setStart("");
      setEnd("");
      setMaxBookings(1);
      await load();
    } catch (e) {
      toast({
        title: "Could not create slot",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this slot? Any bookings on it will also be removed."))
      return;
    try {
      const res = await fetch(
        `/api/events/${eventId}/mentor-availability?id=${id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast({ title: "Slot deleted" });
      await load();
    } catch (e) {
      toast({
        title: "Could not delete slot",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My mentor availability</h1>
        <p className="text-sm text-muted-foreground">
          Add time windows when participants can book a session with you.
        </p>
      </div>

      <Card className="p-4">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="start">Start</Label>
              <Input
                id="start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end">End</Label>
              <Input
                id="end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1 max-w-xs">
            <Label htmlFor="max">Max bookings</Label>
            <Input
              id="max"
              type="number"
              min={1}
              max={50}
              value={maxBookings}
              onChange={(e) =>
                setMaxBookings(Math.max(1, Number(e.target.value) || 1))
              }
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add slot"}
          </Button>
        </form>
      </Card>

      <div>
        <h2 className="text-lg font-medium mb-3">Your slots</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : ownSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No slots yet. Add your first above.
          </p>
        ) : (
          <div className="space-y-3">
            {ownSlots.map((s) => (
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
                    {s.booking_count} / {s.max_bookings} booked
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(s.id)}
                >
                  Delete
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
