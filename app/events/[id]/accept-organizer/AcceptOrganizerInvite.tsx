"use client";

import { AcceptRoleInvite } from "@/components/events/accept-role-invite";
import { EventRole } from "@/lib/types";

interface AcceptOrganizerInviteProps {
  eventId: string;
  eventName: string;
  eventBlurb: string | null;
  eventSlug: string | null;
  invitedEmail?: string;
  eventNotFound?: boolean;
}

export function AcceptOrganizerInvite(props: AcceptOrganizerInviteProps) {
  return <AcceptRoleInvite {...props} role={EventRole.Organizer} />;
}
