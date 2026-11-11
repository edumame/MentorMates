export const NOTIFICATIONS_EMAIL_FROM = "MentorMates <notifications@hello.mentormates.ai>"
export const ADMIN_EMAIL = "admin@mentormates.ai"

export enum EMAIL_TYPES {
  EVENT_UPDATE = "event_update",
  EVENT_SCHEDULE_UPDATE = "schedule_update",
  EVENT_CUSTOM_UPDATE = "custom_update",
  CHECKIN_QR_CODE = "checkin_qr_code",
  ORGANIZER_INVITATION = "organizer_invitation",
  CLAIM_TICKET = "claim_ticket",
  // Server-internal (participants route); not accepted from clients.
  EVENT_ROLE_CHANGED = "event_role_changed",
  EVENT_MEMBER_REMOVED = "event_member_removed",
}
