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
      description="Enter an email address to invite someone as a judge. Existing users are added to the event immediately, and anyone without an account receives an invitation link to sign in and accept the judge role."
      endpoint="/api/events/invite-judge"
      ariaLabel="Judge email address"
      loadingLabel="Inviting..."
      successTitle="Judge Invited"
      successDescription={(email, userExists) =>
        userExists
          ? `${email} has been added as a judge and will receive an email with next steps.`
          : `An invitation email has been sent to ${email}. They can sign in or create an account to accept the judge role.`
      }
    />
  );
}
