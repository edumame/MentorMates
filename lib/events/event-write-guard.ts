import { EventVisibility } from "@/lib/types";

/**
 * Server-side mirror of the events write triggers (XL-001).
 *
 * The DB triggers guard_event_ownership_fields / guard_event_moderation_fields /
 * enforce_archived_event_read_only / guard_archived_event_child_write only
 * apply to end-user (anon/authenticated) requests. Server routes that write
 * with the service role on behalf of a user (the agent API) must apply the
 * same rules here, so both paths refuse the same changes:
 *  - a non-admin cannot make an event public unless it is admin-approved;
 *  - a non-admin cannot change featured / approval_status, and cannot move an
 *    event to demo/test visibility (same rule as event creation);
 *  - an archived event is read-only for non-admins, except that a manager may
 *    unarchive it (a visibility-only change).
 */

export const ARCHIVED_READ_ONLY_ERROR = "archived events are read-only; unarchive first";
export const PUBLIC_REQUIRES_APPROVAL_ERROR =
  "Events can only be made public after they are approved";
export const MODERATION_FIELDS_ERROR =
  "Only administrators may approve or feature events";
export const ADMIN_ONLY_VISIBILITY_ERROR =
  "Only administrators may set demo or test visibility";

/** Visibilities only admins may set (same rule as resolveCreateModeration). */
const ADMIN_ONLY_VISIBILITIES: ReadonlySet<string> = new Set([
  EventVisibility.Demo,
  EventVisibility.Test,
]);

export type EventWriteGuardResult =
  | { ok: true }
  | { ok: false; status: 403 | 409; error: string };

export interface EventWriteState {
  visibility: string | null;
  approval_status: string | null;
  featured?: boolean | null;
}

const OK: EventWriteGuardResult = { ok: true };

/** Writes to an event's child rows (participants, projects, lessons, ...). */
export function checkArchivedEventChildWrite({
  isAdmin,
  visibility,
}: {
  isAdmin: boolean;
  visibility: string | null | undefined;
}): EventWriteGuardResult {
  if (!isAdmin && visibility === EventVisibility.Archived) {
    return { ok: false, status: 409, error: ARCHIVED_READ_ONLY_ERROR };
  }
  return OK;
}

/**
 * An UPDATE of the events row itself. `patch` holds only the fields being
 * written. The caller must already have checked that the user manages the
 * event.
 */
export function checkEventUpdate({
  isAdmin,
  current,
  patch,
}: {
  isAdmin: boolean;
  current: EventWriteState;
  patch: Record<string, unknown>;
}): EventWriteGuardResult {
  if (isAdmin) return OK;

  if (
    ("featured" in patch && Boolean(patch.featured) !== Boolean(current.featured)) ||
    ("approval_status" in patch && patch.approval_status !== current.approval_status)
  ) {
    return { ok: false, status: 403, error: MODERATION_FIELDS_ERROR };
  }

  if (
    typeof patch.visibility === "string" &&
    patch.visibility !== current.visibility &&
    ADMIN_ONLY_VISIBILITIES.has(patch.visibility)
  ) {
    return { ok: false, status: 403, error: ADMIN_ONLY_VISIBILITY_ERROR };
  }

  if (current.visibility === EventVisibility.Archived) {
    const changedOtherThanVisibility = Object.keys(patch).some(
      (key) => key !== "visibility" && key !== "updated_at"
    );
    if (changedOtherThanVisibility) {
      return { ok: false, status: 409, error: ARCHIVED_READ_ONLY_ERROR };
    }
  }

  if (
    patch.visibility === EventVisibility.Public &&
    current.visibility !== EventVisibility.Public &&
    current.approval_status !== "approved"
  ) {
    return { ok: false, status: 403, error: PUBLIC_REQUIRES_APPROVAL_ERROR };
  }

  return OK;
}
