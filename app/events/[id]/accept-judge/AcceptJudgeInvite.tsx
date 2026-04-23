"use client";

import { AcceptRoleInvite } from "@/components/events/accept-role-invite";
import { EventRole } from "@/lib/types";

interface AcceptJudgeInviteProps {
  eventId: string;
  eventName: string;
  eventBlurb: string | null;
  eventSlug: string | null;
  invitedEmail?: string;
  eventNotFound?: boolean;
}

export function AcceptJudgeInvite(props: AcceptJudgeInviteProps) {
  return <AcceptRoleInvite {...props} role={EventRole.Judge} />;
}
