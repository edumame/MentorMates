"use client";

import { InviteRoleTab } from "./InviteRoleTab";

interface InviteJudgesTabProps {
  eventId: string;
  isArchived: boolean;
}

export function InviteJudgesTab({
  eventId,
  isArchived,
}: InviteJudgesTabProps) {
  return (
    <InviteRoleTab
      eventId={eventId}
      isArchived={isArchived}
      title="Invite Judges"
      placeholder="Enter judge email address"
      description="Enter an email address to invite someone as a judge. They receive an invitation link and become a judge once they sign in (or create an account) with that email and accept."
      endpoint="/api/events/invite-judge"
      ariaLabel="Judge email address"
      loadingLabel="Inviting..."
      successTitle="Judge Invited"
      successDescription={(email) =>
        `An invitation email has been sent to ${email}. They can sign in or create an account to accept the judge role.`
      }
    />
  );
}
