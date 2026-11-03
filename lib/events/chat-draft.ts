/**
 * The event draft the creation chat at /events/new builds up.
 *
 * Pure and shared by client and server: the chat route applies the model's
 * patch with `applyDraftPatch`, the preview card edits the same shape inline,
 * and Create turns it into a POST /api/events body with `draftToCreatePayload`.
 * Validation of that body lives in lib/events/create-event (the one schema
 * both create paths use); this module only keeps the draft inside its limits.
 */

import { z } from "zod";
import { EVENT_FIELD_LIMITS, EVENT_SLUG_PATTERN } from "./create-event";

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

export interface DraftScheduleItem {
  time: string;
  name: string;
  description?: string;
}

export interface DraftScheduleDay {
  /** Day label as the event page shows it, e.g. "Friday, Nov 6". */
  day: string;
  items: DraftScheduleItem[];
}

/** `null` means not known yet; "unlimited" means the organiser said no cap. */
export type DraftCapacity = number | "unlimited" | null;

export interface EventDraft {
  event_name: string;
  /** Wall-clock start in `timezone`, "YYYY-MM-DDTHH:mm". */
  start: string;
  /** Wall-clock end in `timezone`, "YYYY-MM-DDTHH:mm", or "". */
  end: string;
  /** IANA zone, e.g. "America/Los_Angeles". */
  timezone: string;
  location: string;
  event_blurb: string;
  /** Markdown. */
  event_description: string;
  schedule: DraftScheduleDay[];
  /** Hosts / affiliation, stored as events.organizer_affiliation. */
  hosts: string;
  require_participant_approval: boolean | null;
  participant_capacity: DraftCapacity;
  slug: string;
  /** True once the organiser (or the chat on their word) set the slug; stops it following the name. */
  slug_custom: boolean;
  event_type: string[];
}

export const DRAFT_LIMITS = {
  name: EVENT_FIELD_LIMITS.nameMax,
  location: EVENT_FIELD_LIMITS.locationMax,
  blurb: EVENT_FIELD_LIMITS.blurbMax,
  description: EVENT_FIELD_LIMITS.descriptionMax,
  hosts: EVENT_FIELD_LIMITS.affiliationMax,
  /** Auto-derived slugs stay short enough to type; a custom one may use the full limit. */
  autoSlug: 60,
  slug: EVENT_FIELD_LIMITS.slugMax,
  scheduleDays: 14,
  scheduleItemsPerDay: 40,
  scheduleText: 300,
  eventTypes: 5,
} as const;

export const DEFAULT_EVENT_TYPE = "hackathon";

export function emptyDraft(timezone: string = browserTimeZone()): EventDraft {
  return {
    event_name: "",
    start: "",
    end: "",
    timezone: isValidTimeZone(timezone) ? timezone : "UTC",
    location: "",
    event_blurb: "",
    event_description: "",
    schedule: [],
    hosts: "",
    require_participant_approval: null,
    participant_capacity: null,
    slug: "",
    slug_custom: false,
    event_type: [DEFAULT_EVENT_TYPE],
  };
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

/** Lowercase, hyphenated, URL-safe; cut at a hyphen boundary when long. */
export function slugify(text: string, maxLength: number = DRAFT_LIMITS.autoSlug): string {
  const base = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length <= maxLength) return base;
  const cut = base.slice(0, maxLength);
  const lastHyphen = cut.lastIndexOf("-");
  return (lastHyphen > maxLength / 2 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= DRAFT_LIMITS.slug && EVENT_SLUG_PATTERN.test(slug);
}

// ---------------------------------------------------------------------------
// Time zones
// ---------------------------------------------------------------------------

const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function isValidTimeZone(timezone: string): boolean {
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** "YYYY-MM-DDTHH:mm" with real calendar values, or false. */
export function isValidWallTime(value: string): boolean {
  const m = WALL_TIME.exec(value);
  if (!m) return false;
  const [, y, mo, d, h, mi] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d &&
    h < 24 &&
    mi < 60
  );
}

/** Milliseconds `timezone` is ahead of UTC at `instant`. */
function zoneOffsetMs(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * The UTC instant of a wall-clock time in an IANA zone, as an ISO string.
 * "2026-11-06T15:30" in America/Los_Angeles -> "2026-11-06T23:30:00.000Z".
 * Returns null for an invalid time or zone.
 */
export function wallTimeToUtcIso(wallTime: string, timezone: string): string | null {
  if (!isValidWallTime(wallTime) || !isValidTimeZone(timezone)) return null;
  const [, y, mo, d, h, mi] = WALL_TIME.exec(wallTime)!.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const firstOffset = zoneOffsetMs(guess, timezone);
  let utc = guess - firstOffset;
  // Across a DST change the offset at the true instant differs from the guess's.
  const secondOffset = zoneOffsetMs(utc, timezone);
  if (secondOffset !== firstOffset) utc = guess - secondOffset;
  return new Date(utc).toISOString();
}

/** The wall-clock "YYYY-MM-DDTHH:mm" of a UTC instant in `timezone`, or null. */
export function utcIsoToWallTime(iso: string, timezone: string): string | null {
  const instant = Date.parse(iso);
  if (Number.isNaN(instant) || !isValidTimeZone(timezone)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** One wall time for the card: "Fri, Nov 6, 3:30 PM", or "5:30 PM" with `timeOnly`. */
export function formatWallTime(wallTime: string, timezone: string, timeOnly = false): string {
  const iso = wallTimeToUtcIso(wallTime, timezone);
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    ...(timeOnly ? {} : { weekday: "short", month: "short", day: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** The zone's short name at the draft's start ("PST"), or the IANA id. */
export function zoneLabel(timezone: string, wallTime?: string): string {
  if (!isValidTimeZone(timezone)) return timezone;
  const iso = (wallTime && wallTimeToUtcIso(wallTime, timezone)) || new Date().toISOString();
  return (
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "short" })
      .formatToParts(new Date(iso))
      .find((p) => p.type === "timeZoneName")?.value ?? timezone
  );
}

/** "Fri, Nov 6, 3:30 PM – 5:30 PM PST" (or with an end date when it differs). */
export function formatDraftWhen(draft: Pick<EventDraft, "start" | "end" | "timezone">): string {
  const tz = draft.timezone;
  const start = formatWallTime(draft.start, tz);
  if (!start) return "";
  const zone = zoneLabel(tz, draft.start);
  const sameDay = draft.start.slice(0, 10) === draft.end.slice(0, 10);
  const end = draft.end ? formatWallTime(draft.end, tz, sameDay) : "";
  return end ? `${start} – ${end} ${zone}` : `${start} ${zone}`;
}

// ---------------------------------------------------------------------------
// Patches (from the model or from an inline edit)
// ---------------------------------------------------------------------------

export type DraftPatch = Partial<Omit<EventDraft, "slug_custom">>;

const clampText = (max: number) => z.string().transform((s) => s.trim().slice(0, max));

const scheduleItemSchema = z.object({
  time: clampText(DRAFT_LIMITS.scheduleText).catch(""),
  name: clampText(DRAFT_LIMITS.scheduleText),
  description: clampText(DRAFT_LIMITS.scheduleText * 3).optional().catch(undefined),
});

const scheduleDaySchema = z.object({
  day: clampText(DRAFT_LIMITS.scheduleText).catch(""),
  items: z.array(scheduleItemSchema.nullable().catch(null)).catch([]),
});

/**
 * Each draft field's own parser. A patch is read field by field, so one bad
 * value from the model drops only that field, never the whole reply.
 */
const PATCH_FIELDS: { [K in keyof DraftPatch]-?: z.ZodType<DraftPatch[K], z.ZodTypeDef, unknown> } = {
  event_name: clampText(DRAFT_LIMITS.name),
  start: z.string().trim().refine(isValidWallTime),
  end: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidWallTime(v)),
  timezone: z.string().trim().refine(isValidTimeZone),
  location: clampText(DRAFT_LIMITS.location),
  event_blurb: clampText(DRAFT_LIMITS.blurb),
  event_description: clampText(DRAFT_LIMITS.description),
  schedule: z
    .array(scheduleDaySchema.nullable().catch(null))
    .transform((days) =>
      days
        .filter((d): d is DraftScheduleDay => d !== null)
        .slice(0, DRAFT_LIMITS.scheduleDays)
        .map((d) => ({
          day: d.day,
          items: d.items
            .filter((i): i is DraftScheduleItem => i !== null && i.name.length > 0)
            .slice(0, DRAFT_LIMITS.scheduleItemsPerDay)
            .map((i) => (i.description ? i : { time: i.time, name: i.name })),
        }))
        .filter((d) => d.items.length > 0)
    ),
  hosts: clampText(DRAFT_LIMITS.hosts),
  require_participant_approval: z.boolean().nullable(),
  participant_capacity: z.union([
    z.number().int().positive().max(1_000_000),
    z.literal("unlimited"),
    z.null(),
  ]),
  slug: z
    .string()
    .transform((s) => slugify(s, DRAFT_LIMITS.slug))
    .refine(isValidSlug),
  event_type: z
    .array(z.string())
    .transform((types) =>
      Array.from(new Set(types.map((t) => t.trim().toLowerCase()).filter(Boolean))).slice(0, DRAFT_LIMITS.eventTypes)
    )
    .refine((types) => types.length > 0),
};

/** Keeps the fields of `raw` that parse; drops the rest. Never throws. */
export function sanitizeDraftPatch(raw: unknown): DraftPatch {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const input = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(PATCH_FIELDS) as (keyof DraftPatch)[]) {
    if (!(key in input)) continue;
    const parsed = PATCH_FIELDS[key].safeParse(input[key]);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as DraftPatch;
}

/**
 * Applies a sanitized patch. The slug follows the name until it is set
 * explicitly; an explicit slug sticks through later renames.
 */
export function applyDraftPatch(draft: EventDraft, patch: DraftPatch): EventDraft {
  const next: EventDraft = { ...draft, ...patch };
  if (patch.slug !== undefined) {
    next.slug_custom = true;
  } else if (!draft.slug_custom && patch.event_name !== undefined) {
    next.slug = slugify(next.event_name);
  }
  // An end before the start is a mistake, not a multi-day event: drop it.
  if (next.end && next.start && next.end <= next.start) next.end = "";
  return next;
}

/** Validates a whole draft sent back by the client (all fields), falling back field by field to empty. */
export function sanitizeDraft(raw: unknown, fallbackTimeZone = "UTC"): EventDraft {
  const base = emptyDraft(fallbackTimeZone);
  const patch = sanitizeDraftPatch(raw);
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    ...base,
    ...patch,
    slug_custom: input.slug_custom === true && patch.slug !== undefined,
  };
}

// ---------------------------------------------------------------------------
// What is still missing
// ---------------------------------------------------------------------------

export type DraftField =
  | "event_name"
  | "start"
  | "location"
  | "hosts"
  | "require_participant_approval"
  | "participant_capacity";

/** Needed before Create can run (the create schema's required fields). */
export const REQUIRED_FIELDS: DraftField[] = ["event_name", "start", "location"];

/** Asked once each, after the required ones, but never block Create. */
export const ASKED_FIELDS: DraftField[] = ["hosts", "require_participant_approval", "participant_capacity"];

export const FIELD_QUESTIONS: Record<DraftField, string> = {
  event_name: "What's the event called?",
  start: "When is it? A date, start time and end time is perfect.",
  location: "Where is it happening?",
  hosts: "Who's hosting it?",
  require_participant_approval: "Should sign-ups need your approval?",
  participant_capacity: "Is there a cap on how many people can join?",
};

export const FIELD_LABELS: Record<DraftField, string> = {
  event_name: "name",
  start: "date and time",
  location: "location",
  hosts: "hosts",
  require_participant_approval: "approval",
  participant_capacity: "capacity",
};

function isFilled(draft: EventDraft, field: DraftField): boolean {
  switch (field) {
    case "event_name":
      return draft.event_name.trim().length >= EVENT_FIELD_LIMITS.nameMin;
    case "start":
      return wallTimeToUtcIso(draft.start, draft.timezone) !== null;
    case "location":
      return draft.location.trim().length > 0;
    case "hosts":
      return draft.hosts.trim().length > 0;
    case "require_participant_approval":
      return draft.require_participant_approval !== null;
    case "participant_capacity":
      return draft.participant_capacity !== null;
  }
}

/** Required first, then the asked-once fields, in the order the chat asks them. */
export function missingFields(draft: EventDraft): DraftField[] {
  return [...REQUIRED_FIELDS, ...ASKED_FIELDS].filter((f) => !isFilled(draft, f));
}

export function missingRequired(draft: EventDraft): DraftField[] {
  return REQUIRED_FIELDS.filter((f) => !isFilled(draft, f));
}

export function isDraftStarted(draft: EventDraft): boolean {
  return Boolean(draft.event_name || draft.start || draft.location || draft.event_description);
}

/**
 * Makes sure an assistant reply ends in one short question when something is
 * still missing: the model is told to ask, and this is the fallback when it
 * does not. A reply that already asks something is left alone.
 */
export function withNextQuestion(reply: string, draft: EventDraft): string {
  const text = reply.trim();
  const next = missingFields(draft)[0];
  if (!next || text.includes("?")) return text;
  return text ? `${text}\n\n${FIELD_QUESTIONS[next]}` : FIELD_QUESTIONS[next];
}

/** A message this short that holds a link is a link to import, not event text. */
export const LINK_MESSAGE_MAX_CHARS = 300;

/**
 * The event link to import from a chat message, if the message is a link
 * (with maybe a few words around it). Long pasted text that happens to
 * contain links is drafted from directly instead.
 */
export function eventLinkIn(message: string): string | null {
  const text = message.trim();
  if (!text || text.length > LINK_MESSAGE_MAX_CHARS) return null;
  const match = /https?:\/\/[^\s<>"')]+/i.exec(text);
  if (!match) return null;
  try {
    const url = new URL(match[0].replace(/[.,;!?]+$/, ""));
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface DraftCreatePayload {
  event: {
    event_name: string;
    event_date: string;
    location: string;
    visibility: "draft";
    event_type: string[];
    slug?: string;
    event_blurb?: string;
    event_description?: string;
    organizer_affiliation?: string;
    submission_time_start?: string;
    submission_time_cutoff?: string;
    participant_capacity?: number;
    require_participant_approval: boolean;
    event_schedule?: { time: string; events: DraftScheduleItem[] }[];
  };
}

export class DraftNotReadyError extends Error {
  constructor(public readonly missing: DraftField[]) {
    super(`Still needs: ${missing.map((f) => FIELD_LABELS[f]).join(", ")}`);
    this.name = "DraftNotReadyError";
  }
}

/**
 * The POST /api/events body for a draft. Times are stored as UTC instants;
 * the event window doubles as the submission window, as the events table's
 * own hand-made rows do. Events are created as drafts: the organiser
 * publishes from the event page.
 */
export function draftToCreatePayload(draft: EventDraft): DraftCreatePayload {
  const missing = missingRequired(draft);
  if (missing.length > 0) throw new DraftNotReadyError(missing);

  const start = wallTimeToUtcIso(draft.start, draft.timezone)!;
  const end = draft.end ? wallTimeToUtcIso(draft.end, draft.timezone) : null;
  const slug = draft.slug || slugify(draft.event_name);

  const event: DraftCreatePayload["event"] = {
    event_name: draft.event_name.trim(),
    event_date: start,
    location: draft.location.trim(),
    visibility: "draft",
    event_type: draft.event_type.length > 0 ? draft.event_type : [DEFAULT_EVENT_TYPE],
    require_participant_approval: draft.require_participant_approval ?? false,
  };
  if (isValidSlug(slug)) event.slug = slug;
  if (draft.event_blurb.trim()) event.event_blurb = draft.event_blurb.trim();
  if (draft.event_description.trim()) event.event_description = draft.event_description.trim();
  if (draft.hosts.trim()) event.organizer_affiliation = draft.hosts.trim();
  if (end) {
    event.submission_time_start = start;
    event.submission_time_cutoff = end;
  }
  if (typeof draft.participant_capacity === "number") {
    event.participant_capacity = draft.participant_capacity;
  }
  if (draft.schedule.length > 0) {
    event.event_schedule = draft.schedule.map((day) => ({ time: day.day, events: day.items }));
  }
  return { event };
}
