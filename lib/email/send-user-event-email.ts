import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCheckinQRCodeEmail,
  getEventMemberRemovedNotificationEmail,
  getEventRoleChangedNotificationEmail,
  getEventScheduleUpdateNotificationEmail,
  getEventUpdateNotificationEmail,
} from "@/lib/email_templates/event-notifications";
import { EMAIL_TYPES, NOTIFICATIONS_EMAIL_FROM } from "@/lib/email_templates/constants";
import type { EventDetails } from "@/lib/types";

/** Email types that can be sent to one member of an event. */
export const USER_EVENT_EMAIL_TYPES = [
  EMAIL_TYPES.EVENT_UPDATE,
  EMAIL_TYPES.EVENT_SCHEDULE_UPDATE,
  EMAIL_TYPES.CHECKIN_QR_CODE,
] as const;

export type UserEventEmailType = (typeof USER_EVENT_EMAIL_TYPES)[number];

export function isUserEventEmailType(value: unknown): value is UserEventEmailType {
  return (USER_EVENT_EMAIL_TYPES as readonly unknown[]).includes(value);
}

/** Types only server code sends (never accepted from a request body). */
export type InternalUserEventEmailType =
  | UserEventEmailType
  | EMAIL_TYPES.EVENT_ROLE_CHANGED
  | EMAIL_TYPES.EVENT_MEMBER_REMOVED;

export type SendUserEventEmailResult =
  | { ok: true; id?: string }
  | { ok: false; status: 404 | 503 | 502 | 500; error: string };

/**
 * Send an event email to one member of that event.
 *
 * Callers MUST authorize the sender first (organizer/admin of eventId, or the
 * member themself for their own check-in email). This helper uses the service
 * client, verifies that the recipient belongs to the event, and always takes
 * the event name and details from the database, never from the request.
 *
 * `membershipAlreadyVerified` is only for callers that verified membership
 * themselves before removing it (e.g. the "you were removed" notification).
 */
export async function sendUserEventEmail({
  service,
  eventId,
  userId,
  emailType,
  membershipAlreadyVerified = false,
}: {
  service: SupabaseClient;
  eventId: string;
  userId: string;
  emailType: InternalUserEventEmailType;
  membershipAlreadyVerified?: boolean;
}): Promise<SendUserEventEmailResult> {
  let memberRole: string | null = null;
  if (!membershipAlreadyVerified) {
    const { data: membership, error: membershipError } = await service
      .from("user_event_roles")
      .select("user_id, role")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) {
      console.error("Failed to verify email recipient membership:", membershipError.code);
      return { ok: false, status: 500, error: "Failed to verify recipient" };
    }
    if (!membership) {
      return { ok: false, status: 404, error: "User not found for this event" };
    }
    memberRole = (membership as { role?: string }).role ?? null;
  }

  const [{ data: event, error: eventError }, { data: profile, error: profileError }] =
    await Promise.all([
      service
        .from("events")
        .select("event_id, event_name, slug, event_schedule")
        .eq("event_id", eventId)
        .maybeSingle(),
      service.from("user_profiles").select("email").eq("uid", userId).maybeSingle(),
    ]);

  if (eventError || profileError) {
    console.error("Failed to load email context:", (eventError ?? profileError)?.code);
    return { ok: false, status: 500, error: "Failed to load email details" };
  }
  if (!event) return { ok: false, status: 404, error: "Event not found" };
  if (!profile?.email) return { ok: false, status: 404, error: "User email not found" };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 503, error: "Email service not configured" };
  }

  const eventName = event.event_name || "Event";
  const details = event as unknown as EventDetails;
  let template;
  switch (emailType) {
    case EMAIL_TYPES.EVENT_UPDATE:
      template = getEventUpdateNotificationEmail(eventName, eventId, details);
      break;
    case EMAIL_TYPES.EVENT_SCHEDULE_UPDATE:
      template = getEventScheduleUpdateNotificationEmail(eventName, eventId, details);
      break;
    case EMAIL_TYPES.EVENT_ROLE_CHANGED:
      template = getEventRoleChangedNotificationEmail(eventName, eventId, details, memberRole ?? "member");
      break;
    case EMAIL_TYPES.EVENT_MEMBER_REMOVED:
      template = getEventMemberRemovedNotificationEmail(eventName);
      break;
    default:
      template = await getCheckinQRCodeEmail(eventName, eventId);
  }

  try {
    const { data, error } = await new Resend(apiKey).emails.send({
      from: NOTIFICATIONS_EMAIL_FROM,
      to: profile.email,
      subject: template.subject,
      html: template.html,
    });
    if (error) {
      console.error("Failed to send event email:", error.name);
      return { ok: false, status: 502, error: "Error sending email" };
    }
    return { ok: true, id: data?.id };
  } catch (sendError) {
    console.error("Failed to send event email:", sendError);
    return { ok: false, status: 502, error: "Error sending email" };
  }
}
