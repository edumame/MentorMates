import { EventRole } from "@/lib/types";
import { AcceptParticipantInvite } from "./AcceptParticipantInvite";
import {
  loadInviteAcceptanceEvent,
  redirectIfInviteAlreadyAccepted,
} from "@/lib/events/invite-acceptance";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ email?: string; token?: string }>;
}

export default async function AcceptParticipantInvitePage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await Promise.resolve(params);
  const { token } = await Promise.resolve(searchParams);

  const eventData = await loadInviteAcceptanceEvent(id, { token, role: "participant" });

  if (!eventData) {
    return (
      <AcceptParticipantInvite
        eventId=""
        eventName=""
        eventBlurb={null}
        eventSlug={null}
        eventNotFound={true}
      />
    );
  }

  await redirectIfInviteAlreadyAccepted(
    eventData.event_id,
    eventData.slug,
    EventRole.Participant
  );

  return (
    <AcceptParticipantInvite
      eventId={eventData.event_id}
      eventName={eventData.event_name}
      eventBlurb={eventData.event_blurb}
      eventSlug={eventData.slug}
      invitedEmail={eventData.invitedEmail}
      inviteToken={token}
      eventNotFound={false}
    />
  );
}
