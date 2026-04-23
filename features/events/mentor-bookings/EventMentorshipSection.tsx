"use client";

import { useEffect, useState } from "react";
import { EventRole } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MentorAvailabilityManager } from "./MentorAvailabilityManager";
import { MentorBookingManager } from "./MentorBookingManager";
import { hasOpenMentorBookings } from "./utils";
import type { MentorAvailabilityWithBookings } from "@/lib/types/mentor-booking";

interface EventMentorshipSectionProps {
  eventId: string;
  role: EventRole | null | undefined;
  hasJoined: boolean;
}

export function EventMentorshipSection({
  eventId,
  role,
  hasJoined,
}: EventMentorshipSectionProps) {
  const [mentorBookingsOpen, setMentorBookingsOpen] = useState(false);
  const [loading, setLoading] = useState(role === EventRole.Participant);

  useEffect(() => {
    if (!hasJoined || role !== EventRole.Participant) {
      setMentorBookingsOpen(false);
      setLoading(false);
      return;
    }

    const fetchMentorBookingStatus = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/events/${eventId}/mentor-availability`,
          { cache: "no-store" }
        );
        const data = await response.json();

        console.log("Mentor availability data:", data);
        console.log("Availabilties:", data.availability);

        if (!response.ok) {
          throw new Error(data.error || "Failed to load mentor availability");
        }

        setMentorBookingsOpen(
          hasOpenMentorBookings(
            (data.availability ?? []) as MentorAvailabilityWithBookings[]
          )
        );
      } catch (error) {
        console.error("Error determining mentor booking availability:", error);
        setMentorBookingsOpen(false);
      } finally {
        setLoading(false);
      }
    };

    fetchMentorBookingStatus();
  }, [eventId, hasJoined, role]);

  console.log("Current role:", role);

  if (!hasJoined) {
    return null;
  }

  if (role === EventRole.Mentor) {
    return (
      <Card className="mb-8 border border-[rgba(0,0,0,0.15)] shadow-sm">
        <CardHeader>
          <CardTitle className="text-[24px] leading-[32px] tracking-[-0.6px]">
            Mentor Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MentorAvailabilityManager eventId={eventId} showHeader={false} />
        </CardContent>
      </Card>
    );
  }

  if (role !== EventRole.Participant) {
    console.log("Mentorship section not shown for role:", role);
    return null;
  }

  if (loading || !mentorBookingsOpen) {
    console.log("Mentorship section not shown for loading:", loading, "and mentorBookingsOpen:", mentorBookingsOpen);
    return null;
  }

  return (
    <Card className="mb-8 border border-[rgba(0,0,0,0.15)] shadow-sm">
      <CardHeader>
        <CardTitle className="text-[24px] leading-[32px] tracking-[-0.6px]">
          Mentor Sessions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <MentorBookingManager eventId={eventId} showHeader={false} />
      </CardContent>
    </Card>
  );
}
