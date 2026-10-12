import { createSupabaseClient } from "@/app/utils/supabase/server";
import { UUID } from "crypto";
import { isValidUUID } from "@/app/utils/supabase/queries";
import { notFound } from "next/navigation";
import { EventPageLayout } from "@/components/events/event-page-layout";
import {
  ParticipantsContent,
  type ParticipantWithRole,
} from "@/components/events/participants-content";
import { headers } from "next/headers";
import { EventRole } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

const ALL_ROLES = [
  EventRole.Organizer,
  EventRole.Admin,
  EventRole.Participant,
  EventRole.Mentor,
  EventRole.Judge,
].join(",");

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
    role_labels,
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
      const rolesParam = canViewMultipleRoles
        ? ALL_ROLES
        : EventRole.Participant;
      const response = await fetch(
        `${baseUrl}/api/events/${eventData.event_id}/users?roles=${rolesParam}&limit=500`,
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
          (u: {
            user_id: UUID;
            uid: UUID;
            display_name: string | null;
            role: EventRole;
          }) => ({
            uid: u.uid || u.user_id,
            display_name: u.display_name,
            role: u.role,
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
        canViewParticipants={hasJoined || isAdmin}
        showRoleFilter={canViewMultipleRoles}
        eventRoleLabels={
          (eventData.role_labels as Record<string, string> | null) || null
        }
      />
    </EventPageLayout>
  );
}
