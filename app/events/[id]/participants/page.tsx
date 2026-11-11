import { createSupabaseClient } from "@/app/utils/supabase/server";
import { notFound } from "next/navigation";
import { EventPageLayout } from "@/components/events/event-page-layout";
import {
  ParticipantsContent,
  type ParticipantWithRole,
} from "@/components/events/participants-content";
import { headers } from "next/headers";
import { EventRole } from "@/lib/types";
import { fetchAllEventUsers } from "@/features/user/dashboards/dashboard/organizer/participants/fetch-event-users";

import { resolveEventRouteId } from "@/lib/events/resolve-event-route";
interface PageProps {
  params: Promise<{ id: string }>;
}

const ALL_ROLES = [
  EventRole.Organizer,
  EventRole.Admin,
  EventRole.Participant,
  EventRole.Mentor,
  EventRole.Judge,
];

export default async function PublicParticipantsPage({ params }: PageProps) {
  const supabase = await createSupabaseClient();
  const { id } = await params;


  let eventQuery = supabase.from("events").select(`
    event_id,
    event_name,
    event_blurb,
    event_date,
    location,
    cover_image_url,
    role_labels,
    slug,
    paid
  `);

  // ORG-014: one shared rule resolves the param (event_id before slug).
  const routeEventId = await resolveEventRouteId(supabase, id);
  if (!routeEventId) notFound();
  eventQuery = eventQuery.eq("event_id", routeEventId);

  const { data: eventData, error: eventError } = await eventQuery.single();

  if (eventError || !eventData) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasJoined = false;
  let viewerRole: EventRole | null = null;
  let isAdmin = false;

  if (user) {
    const { data: userEventRole } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("event_id", eventData.event_id)
      .maybeSingle();
    if (userEventRole) {
      hasJoined = true;
      viewerRole = userEventRole.role as EventRole;
    }

    const { data: isAdminRpc } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });
    isAdmin = Boolean(isAdminRpc);
  }

  const canViewMultipleRoles =
    isAdmin ||
    viewerRole === EventRole.Organizer ||
    viewerRole === EventRole.Admin;

  let participantsList: ParticipantWithRole[] = [];

  if (hasJoined || isAdmin) {
    const requestHeaders = await headers();
    const host =
      requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
    const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (host ? `${protocol}://${host}` : "");

    if (baseUrl) {
      const roles = canViewMultipleRoles ? ALL_ROLES : [EventRole.Participant];
      const cookie = requestHeaders.get("cookie") || "";
      try {
        // Page through every member (ORG-024): one limit=500 request silently
        // dropped everyone past the first page. Server fetches need an
        // absolute URL and the viewer's cookie.
        const { users } = await fetchAllEventUsers(
          eventData.event_id,
          roles,
          (input, init) =>
            fetch(`${baseUrl}${String(input)}`, {
              ...init,
              cache: "no-store",
              headers: { cookie },
            })
        );
        participantsList = users.map((u) => ({
          uid: u.uid || u.user_id,
          display_name: u.display_name,
          role: u.role,
        }));
      } catch (error) {
        console.error("Error fetching participants via API route:", error);
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
        canViewParticipants={hasJoined || isAdmin}
        showRoleFilter={canViewMultipleRoles}
        eventRoleLabels={
          (eventData.role_labels as Record<string, string> | null) || null
        }
      />
    </EventPageLayout>
  );
}
