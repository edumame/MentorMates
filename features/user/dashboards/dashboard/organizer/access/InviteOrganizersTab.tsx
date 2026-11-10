"use client";

import { InviteRoleTab } from "./InviteRoleTab";

interface InviteOrganizersTabProps {
  eventId: string;
  isArchived: boolean;
}

export function InviteOrganizersTab({
  eventId,
  isArchived,
}: InviteOrganizersTabProps) {
  return (
    <InviteRoleTab
      eventId={eventId}
      isArchived={isArchived}
      title="Invite Organizers"
      placeholder="Enter organizer email address"
      description="Enter an email address to invite someone as an organizer. They receive an invitation link and become an organizer once they sign in (or create an account) with that email and accept."
      endpoint="/api/events/invite-organizer"
      ariaLabel="Organizer email address"
      loadingLabel="Inviting..."
      successTitle="Organizer Invited Successfully"
      successDescription={(email) =>
        `An invitation email has been sent to ${email}. They will receive a link to sign in or sign up and accept the organizer role.`
      }
    />
  );
}
