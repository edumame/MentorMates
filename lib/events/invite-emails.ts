import { EventVisibility } from "@/lib/types";
import {
  getEventRoleInvitationEmailTemplate,
  type EventInviteRole,
} from "@/lib/email_templates/event-role-invitation";
import { getOrganizerInvitationEmailTemplate } from "@/lib/email_templates/organizer-invitation";

export interface EventInviteSummary {
  deferred: boolean;
  sent: Record<EventInviteRole, number>;
  failed: Record<EventInviteRole, string[]>;
}

export interface OrganizerInviteSummary {
  sent: number;
  failed: string[];
}

export function normalizeInviteEmails(emails: string[] | undefined): string[] {
  if (!emails) return [];

  return Array.from(
    new Set(
      emails
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export function getEventOverviewUrl(
  appOrigin: string,
  eventSlugOrId: string
): string {
  return `${appOrigin.replace(/\/$/, "")}/events/${eventSlugOrId}/overview`;
}

export function getEventInviteAcceptanceUrl(
  appOrigin: string,
  eventSlugOrId: string,
  role: EventInviteRole,
  email: string
): string {
  const route = role === "participant" ? "accept-participant" : "accept-judge";
  const origin = appOrigin.replace(/\/$/, "");
  return `${origin}/events/${eventSlugOrId}/${route}?email=${encodeURIComponent(
    email
  )}`;
}

export function getOrganizerInviteAcceptanceUrl(
  appOrigin: string,
  eventSlugOrId: string,
  email: string
): string {
  const origin = appOrigin.replace(/\/$/, "");
  return `${origin}/events/${eventSlugOrId}/accept-organizer?email=${encodeURIComponent(
    email
  )}`;
}

export async function sendEventInviteEmails({
  appOrigin,
  eventId,
  eventName,
  eventSlug,
  inviterName,
  visibility,
  participantInviteEmails,
  judgeInviteEmails,
  deferIfDraft = true,
  sendEmail,
}: {
  appOrigin: string;
  eventId: string;
  eventName: string;
  eventSlug?: string | null;
  inviterName: string;
  visibility: EventVisibility;
  participantInviteEmails?: string[];
  judgeInviteEmails?: string[];
  deferIfDraft?: boolean;
  sendEmail?: (message: {
    to: string;
    subject: string;
    html: string;
  }) => Promise<boolean>;
}): Promise<EventInviteSummary> {
  const normalizedParticipants = normalizeInviteEmails(participantInviteEmails);
  const normalizedJudges = normalizeInviteEmails(judgeInviteEmails);

  const summary: EventInviteSummary = {
    deferred: false,
    sent: {
      participant: 0,
      judge: 0,
    },
    failed: {
      participant: [],
      judge: [],
    },
  };

  if (normalizedParticipants.length === 0 && normalizedJudges.length === 0) {
    return summary;
  }

  if (deferIfDraft && visibility === EventVisibility.Draft) {
    summary.deferred = true;
    return summary;
  }

  if (!sendEmail) {
    summary.failed.participant.push(...normalizedParticipants);
    summary.failed.judge.push(...normalizedJudges);
    return summary;
  }

  const eventUrl = getEventOverviewUrl(appOrigin, eventSlug || eventId);
  const eventSlugOrId = eventSlug || eventId;

  const sendRoleEmails = async (role: EventInviteRole, emails: string[]) => {
    await Promise.all(
      emails.map(async (email) => {
        try {
          const actionUrl = getEventInviteAcceptanceUrl(
            appOrigin,
            eventSlugOrId,
            role,
            email
          );
          const template = getEventRoleInvitationEmailTemplate({
            eventName,
            inviterName,
            role,
            actionUrl,
            eventUrl,
          });

          const sent = await sendEmail({
            to: email,
            subject: template.subject,
            html: template.html,
          });

          if (sent) {
            summary.sent[role] += 1;
            return;
          }
        } catch {
          // Fall through to the failure path below.
        }

        summary.failed[role].push(email);
      })
    );
  };

  await sendRoleEmails("participant", normalizedParticipants);
  await sendRoleEmails("judge", normalizedJudges);

  return summary;
}

export async function sendOrganizerInviteEmails({
  appOrigin,
  eventId,
  eventName,
  eventSlug,
  inviterName,
  existingOrganizerEmails,
  newOrganizerEmails,
  sendEmail,
}: {
  appOrigin: string;
  eventId: string;
  eventName: string;
  eventSlug?: string | null;
  inviterName: string;
  existingOrganizerEmails?: string[];
  newOrganizerEmails?: string[];
  sendEmail?: (message: {
    to: string;
    subject: string;
    html: string;
  }) => Promise<boolean>;
}): Promise<OrganizerInviteSummary> {
  const normalizedExisting = normalizeInviteEmails(existingOrganizerEmails);
  const normalizedNew = normalizeInviteEmails(newOrganizerEmails);

  const summary: OrganizerInviteSummary = {
    sent: 0,
    failed: [],
  };

  if (normalizedExisting.length === 0 && normalizedNew.length === 0) {
    return summary;
  }

  if (!sendEmail) {
    summary.failed.push(...normalizedExisting, ...normalizedNew);
    return summary;
  }

  const eventSlugOrId = eventSlug || eventId;
  const eventUrl = getEventOverviewUrl(appOrigin, eventSlugOrId);

  const sendOrganizerEmail = async (email: string, isNewUser: boolean) => {
    try {
      const acceptUrl = isNewUser
        ? getOrganizerInviteAcceptanceUrl(appOrigin, eventSlugOrId, email)
        : undefined;

      const template = getOrganizerInvitationEmailTemplate(
        eventName,
        eventId,
        inviterName,
        eventSlugOrId,
        isNewUser,
        acceptUrl,
        eventUrl
      );

      const sent = await sendEmail({
        to: email,
        subject: template.subject,
        html: template.html,
      });

      if (sent) {
        summary.sent += 1;
        return;
      }
    } catch {
      // Fall through to the failure path below.
    }

    summary.failed.push(email);
  };

  await Promise.all([
    ...normalizedExisting.map((email) => sendOrganizerEmail(email, false)),
    ...normalizedNew.map((email) => sendOrganizerEmail(email, true)),
  ]);

  return summary;
}
