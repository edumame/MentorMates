import { EVENT_NAME_MAX_LENGTH, validateSubmissionWindow } from "@/lib/types/wizard";
import { getEventSlugError } from "@/lib/events/event-slug";

/**
 * Edit Event (Basics) validation, sharing the create-event wizard's rules
 * (ORG-014 slug, ORG-015 submission window, ORG-016 name length).
 */

export const EVENT_NAME_MIN_LENGTH = 3;

export interface BasicInfoInput {
  event_name?: string | null;
  slug?: string | null;
  submission_time_start?: string | null;
  submission_time_cutoff?: string | null;
}

export type BasicInfoValidation =
  | { ok: true; values: { event_name: string; slug: string | null } }
  | { ok: false; title: string; message: string };

export function validateBasicInfo(input: BasicInfoInput): BasicInfoValidation {
  const eventName = (input.event_name ?? "").trim();
  if (eventName.length < EVENT_NAME_MIN_LENGTH || eventName.length > EVENT_NAME_MAX_LENGTH) {
    return {
      ok: false,
      title: "Check the event name",
      message: `Event name must be ${EVENT_NAME_MIN_LENGTH}-${EVENT_NAME_MAX_LENGTH} characters.`,
    };
  }

  // An empty slug is stored as null (the event URL then uses its ID).
  const slug = (input.slug ?? "").trim();
  if (slug) {
    const slugError = getEventSlugError(slug);
    if (slugError) return { ok: false, title: "Check the URL slug", message: slugError };
  }

  // Identical start/cutoff is the DB default (both now()) on older events, so
  // it is let through rather than blocking every edit of those events.
  const start = input.submission_time_start ?? null;
  const cutoff = input.submission_time_cutoff ?? null;
  const windowError = start === cutoff ? null : validateSubmissionWindow(start, cutoff);
  if (windowError) {
    return { ok: false, title: "Check the submission window", message: windowError };
  }

  return { ok: true, values: { event_name: eventName, slug: slug || null } };
}
