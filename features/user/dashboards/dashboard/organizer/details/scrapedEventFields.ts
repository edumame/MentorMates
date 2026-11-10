import type { EventDetails } from "@/lib/types";
import {
  applyScrapedData,
  buildApiPayload,
  INITIAL_WIZARD_EVENT,
} from "@/lib/types/wizard";

/** Scraped times have no offset, so read them as the organizer's local time. */
function toInstant(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Maps /api/scrape output onto an existing event. Only values the page actually
 * supplied are returned, so an absent section never blanks saved content.
 *
 * Unlike the new-event wizard, this leaves out:
 * - slug: the scraper always derives one, and changing it would break the live URL.
 * - tracks and prizes: these are their own database rows, not event fields, so
 *   swapping them in local state would hide the saved ones without replacing them.
 */
export function scrapedEventFields(
  scraped: Record<string, unknown>,
): Partial<EventDetails> {
  const { event: imported } = buildApiPayload(
    applyScrapedData({ ...scraped, tracks: undefined }, INITIAL_WIZARD_EVENT),
  );

  const fields: Partial<EventDetails> = {
    event_name: imported.event_name || undefined,
    event_date: imported.event_date || undefined,
    location: imported.location || undefined,
    event_blurb: imported.event_blurb,
    event_description: imported.event_description,
    submission_time_start: toInstant(imported.submission_time_start),
    submission_time_cutoff: toInstant(imported.submission_time_cutoff),
    // Saved schedules keep a day's title in `time`; the wizard calls it `date`.
    event_schedule: imported.event_schedule?.map(({ date, events }) => ({
      time: date,
      events: events.map(({ name, time, description }) => ({
        name,
        time: time ?? "",
        ...(description ? { description } : {}),
      })),
    })),
    rules: imported.rules,
    event_resources: imported.event_resources,
    faq: imported.faq,
  };

  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}
