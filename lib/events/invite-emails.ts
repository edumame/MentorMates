import { issueEventRoleInviteToken } from "@/lib/events/role-invitations";
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
  email: string,
  token: string
): string {
  const route = role === "participant" ? "accept-participant" : "accept-judge";
  const origin = appOrigin.replace(/\/$/, "");
  return `${origin}/events/${eventSlugOrId}/${route}?email=${encodeURIComponent(
    email
  )}&token=${encodeURIComponent(token)}`;
}

export function getOrganizerInviteAcceptanceUrl(
  appOrigin: string,
  eventSlugOrId: string,
  email: string,
  token: string
): string {
  const origin = appOrigin.replace(/\/$/, "");
  return `${origin}/events/${eventSlugOrId}/accept-organizer?email=${encodeURIComponent(
    email
  )}&token=${encodeURIComponent(token)}`;
}

export async function sendEventInviteEmails({
  appOrigin,
  eventId,
  eventName,
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

  // Emailed links outlive a slug rename, so they use the immutable event id.
  const eventUrl = getEventOverviewUrl(appOrigin, eventId);

  const sendRoleEmails = async (role: EventInviteRole, emails: string[]) => {
    await Promise.all(
      emails.map(async (email) => {
        try {
          const token = await issueEventRoleInviteToken({
            email,
            eventId,
            role,
          });
          const actionUrl = getEventInviteAcceptanceUrl(
            appOrigin,
            eventId,
            role,
            email,
            token
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
  inviterName,
  existingOrganizerEmails,
  newOrganizerEmails,
  sendEmail,
}: {
  appOrigin: string;
  eventId: string;
  eventName: string;
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

  // Email links must be absolute. A missing or malformed deployment origin
  // must fail delivery rather than send recipients a relative/broken URL.
  try {
    const origin = new URL(appOrigin.trim());
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.username || origin.password || origin.pathname !== "/" ||
      origin.search || origin.hash
    ) throw new Error("Invalid application origin");
    appOrigin = origin.origin;
  } catch {
    summary.failed.push(...normalizedExisting, ...normalizedNew);
    return summary;
  }

  // Emailed links outlive a slug rename, so they use the immutable event id.
  const eventUrl = getEventOverviewUrl(appOrigin, eventId);

  const sendOrganizerEmail = async (email: string, isNewUser: boolean) => {
    try {
      // Existing users also need the invitation entry page when signed out.
      // Use the stable ID so a later slug change does not break emailed links.
      const acceptUrl = getOrganizerInviteAcceptanceUrl(
        appOrigin,
        eventId,
        email,
        await issueEventRoleInviteToken({ email, eventId, role: "organizer" })
      );

      const template = getOrganizerInvitationEmailTemplate(
        eventName,
        eventId,
        inviterName,
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
