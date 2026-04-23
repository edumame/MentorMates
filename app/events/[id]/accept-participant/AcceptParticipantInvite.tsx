"use client";

import { AcceptRoleInvite } from "@/components/events/accept-role-invite";
import { EventRole } from "@/lib/types";

interface AcceptParticipantInviteProps {
  eventId: string;
  eventName: string;
  eventBlurb: string | null;
  eventSlug: string | null;
  invitedEmail?: string;
  eventNotFound?: boolean;
}

export function AcceptParticipantInvite(props: AcceptParticipantInviteProps) {
  return <AcceptRoleInvite {...props} role={EventRole.Participant} />;
}
