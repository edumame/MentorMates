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
      description="Enter an email address to invite someone as an organizer. If they don't have an account yet, they'll receive a magic link to sign up and accept the invitation."
      endpoint="/api/events/invite-organizer"
      ariaLabel="Organizer email address"
      loadingLabel="Inviting..."
      successTitle="Organizer Invited Successfully"
      successDescription={(email, userExists) =>
        userExists
          ? `${email} has been granted organizer access and will receive an email notification with instructions to access the organizer dashboard.`
          : `An invitation email has been sent to ${email}. They will receive a link to sign up and accept the organizer role.`
      }
    />
  );
}
