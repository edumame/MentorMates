import { createSupabaseClient } from "@/app/utils/supabase/server";
import { UUID } from "crypto";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { notFound } from "next/navigation";
import { EventPageLayout } from "@/components/events/event-page-layout";
import { ParticipantsContent } from "@/components/events/participants-content";
import { headers } from "next/headers";

interface Participant {
  uid: string;
  display_name: string | null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicParticipantsPage({ params }: PageProps) {
  const supabase = await createSupabaseClient();
  const { id } = await params;

  const isUUID = isValidUUID(id);

  let eventQuery = supabase.from("events").select(`
    event_id,
    event_name,
    event_blurb,
    event_date,
    location,
    cover_image_url,
    slug,
    paid
  `);

  if (isUUID) {
    eventQuery = eventQuery.or(`slug.eq.${id},event_id.eq.${id}`);
  } else {
    eventQuery = eventQuery.eq("slug", id);
  }

  const { data: eventData, error: eventError } = await eventQuery.single();

  if (eventError || !eventData) {
    notFound();
  }

  // Check if user has joined
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasJoined = false;

  if (user) {
    const { data: userEventRole } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("event_id", eventData.event_id)
      .maybeSingle();

    hasJoined = !!userEventRole;
  }

  let participantsList: Participant[] = [];

  if (hasJoined) {
    const requestHeaders = await headers();
    const host =
      requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
    const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (host ? `${protocol}://${host}` : "");

    if (baseUrl) {
      const response = await fetch(
        `${baseUrl}/api/events/${eventData.event_id}/users?roles=participant&limit=500`,
        {
          cache: "no-store",
          headers: {
            cookie: requestHeaders.get("cookie") || "",
          },
        }
      );

      if (response.ok) {
        const payload = await response.json();
        participantsList = (payload.users || []).map(
          (participant: {
            user_id: UUID;
            uid: UUID;
            display_name: string | null;
          }) => ({
            uid: participant.uid || participant.user_id,
            display_name: participant.display_name,
          })
        );
      } else {
        console.error("Error fetching participants via API route");
      }
    }
  }

  return (
    <EventPageLayout
      eventName={eventData.event_name}
      eventBlurb={eventData.event_blurb || ""}
      eventDate={eventData.event_date}
      location={eventData.location}
      coverImageUrl={eventData.cover_image_url}
      eventId={id}
      hasJoined={hasJoined}
      dbEventId={eventData.event_id}
      paid={eventData.paid}
    >
      <ParticipantsContent
        participants={participantsList}
        canViewParticipants={hasJoined}
      />
    </EventPageLayout>
  );
}
