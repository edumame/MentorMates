import { EventRole } from "@/lib/types";
import { AcceptOrganizerInvite } from "./AcceptOrganizerInvite";
import {
  loadInviteAcceptanceEvent,
  redirectIfInviteAlreadyAccepted,
} from "../invite-acceptance";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ email?: string }>;
}

export default async function AcceptOrganizerInvitePage({ params, searchParams }: PageProps) {
  const { id } = await Promise.resolve(params);
  const { email } = await Promise.resolve(searchParams);
  const eventData = await loadInviteAcceptanceEvent(id);

  if (!eventData) {
    return (
      <AcceptOrganizerInvite
        eventId=""
        eventName=""
        eventBlurb={null}
        eventSlug={null}
        invitedEmail={email}
        eventNotFound={true}
      />
    );
  }

  await redirectIfInviteAlreadyAccepted(
    eventData.event_id,
    eventData.slug,
    EventRole.Organizer
  );

  return (
    <AcceptOrganizerInvite
      eventId={eventData.event_id}
      eventName={eventData.event_name}
      eventBlurb={eventData.event_blurb}
      eventSlug={eventData.slug}
      invitedEmail={email}
      eventNotFound={false}
    />
  );
}
