/**
 * Shared validation and insert mapping for creating an event.
 *
 * Both create paths use this module so the fields an organiser can set, their
 * limits, and how they land in `events` cannot drift apart:
 * - POST /api/events (signed-in web users, including the chat at /events/new)
 * - POST /api/agent/events (agent API keys)
 */

import { z } from "zod";
import type { Database, Json } from "@/lib/database.types";

/** URL-safe slug: alphanumeric + hyphen/underscore, starting with a letter or digit. */
export const EVENT_SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

export const EVENT_FIELD_LIMITS = {
  nameMin: 3,
  nameMax: 200,
  locationMax: 500,
  descriptionMax: 5000,
  blurbMax: 500,
  slugMax: 100,
  affiliationMax: 500,
} as const;

export const eventSlugSchema = z
  .string()
  .min(1)
  .max(EVENT_FIELD_LIMITS.slugMax)
  .regex(EVENT_SLUG_PATTERN, {
    message:
      "Slug must start with a letter/digit and contain only letters, digits, hyphens, or underscores",
  });

/**
 * Fields every create path accepts. Routes `.extend()` this with their own
 * extras (tracks shape, cover image, visibility defaults, ...).
 */
export const eventCreateFieldsSchema = z.object({
  event_name: z
    .string()
    .trim()
    .min(EVENT_FIELD_LIMITS.nameMin, "Event name must be at least 3 characters")
    .max(EVENT_FIELD_LIMITS.nameMax),
  event_date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "Invalid event_date — expected ISO date string (e.g. 2026-04-15)",
  }),
  location: z
    .string()
    .trim()
    .min(1, "Location is required")
    .max(EVENT_FIELD_LIMITS.locationMax),
  event_description: z.string().max(EVENT_FIELD_LIMITS.descriptionMax).optional(),
  event_blurb: z.string().max(EVENT_FIELD_LIMITS.blurbMax).optional(),
  slug: eventSlugSchema.optional(),
  submission_time_start: z.string().nullable().optional(),
  submission_time_cutoff: z.string().nullable().optional(),
  participant_capacity: z.number().int().positive().nullable().optional(),
  require_participant_approval: z.boolean().optional(),
  organizer_affiliation: z
    .string()
    .max(EVENT_FIELD_LIMITS.affiliationMax)
    .nullable()
    .optional(),
  event_type: z.array(z.string()).optional(),
  paid: z.boolean().optional(),
  event_schedule: z.array(z.record(z.string(), z.unknown())).optional(),
  faq: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .optional(),
  rules: z
    .array(z.object({ title: z.string(), items: z.array(z.string()) }))
    .optional(),
});

export type EventCreateFields = z.infer<typeof eventCreateFieldsSchema>;

type EventInsert = Database["public"]["Tables"]["events"]["Insert"];

/**
 * Maps the shared fields to an `events` insert. Ownership and moderation
 * defaults are set here, never taken from the request: the creator owns the
 * event and it starts unsubmitted and unfeatured. Routes spread their own
 * extras (visibility, cover image, ...) over the result.
 */
export function buildEventInsert(
  fields: EventCreateFields,
  ownerId: string
): EventInsert {
  return {
    event_name: fields.event_name,
    event_date: fields.event_date,
    location: fields.location,
    rules: (fields.rules ?? []) as unknown as Json,
    slug: fields.slug ?? null,
    event_description: fields.event_description ?? null,
    event_blurb: fields.event_blurb ?? null,
    submission_time_start: fields.submission_time_start ?? null,
    submission_time_cutoff: fields.submission_time_cutoff ?? null,
    participant_capacity: fields.participant_capacity ?? null,
    require_participant_approval: fields.require_participant_approval ?? false,
    organizer_affiliation: fields.organizer_affiliation?.trim() || null,
    paid: fields.paid ?? false,
    ...(fields.event_schedule
      ? { event_schedule: fields.event_schedule as Json }
      : {}),
    faq: (fields.faq as Json) ?? null,
    owner_id: ownerId,
    approval_status: "not_submitted",
    featured: false,
    event_type: fields.event_type ?? [],
  };
}

/** True when a Postgres error is the unique violation on events.slug. */
export function isSlugTakenError(
  error: { message?: string; code?: string } | null | undefined
): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("events_slug_key") || (error.code === "23505" && message.includes("slug"));
}
