/**
 * Wizard Event Data — unified state for the 4-step event creation wizard.
 *
 * This is the single source of truth for all event data during creation.
 * Each wizard step receives { event, setEvent } and reads/writes to this shape.
 *
 * At submit time, buildApiPayload() converts this to the POST /api/events format.
 */

import { EventVisibility } from "./index";

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

export interface WizardScheduleEvent {
  id: string;
  name: string;
  time: string;
  description: string;
  guests?: string;
}

export interface WizardScheduleDay {
  date: string; // YYYY-MM-DD or "Day 1"
  events: WizardScheduleEvent[];
}

export interface WizardFAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface WizardRuleSection {
  id: string;
  title: string;
  items: string[];
}

export interface WizardResource {
  id: string;
  name: string;
  link: string;
}

export interface WizardGalleryImage {
  id: string;
  url: string;
}

export interface WizardCriterion {
  id: string; // "crit-{trackIdx}-{critIdx}"
  name: string;
  description: string;
  type: "numeric" | "multiplechoice";
  weight: number;
  min: number;
  max: number;
  options?: string[];
}

export interface WizardPrize {
  id: string;
  name: string;
  description: string;
  cover_image_url?: string;
}

export interface WizardTrack {
  client_id: string; // "track-{index}-{slug}"
  name: string;
  description: string;
  label?: string;
  prizes: WizardPrize[];
  criteria: WizardCriterion[];
}

export interface WizardSubmissionField {
  id: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "url"
    | "file"
    | "select"
    | "multi_select"
    | "checkbox";
  required: boolean;
  placeholder: string;
  helperText?: string;
  options?: string[];
  multiple?: boolean;
  maxFiles?: number;
}

// ---------------------------------------------------------------------------
// Main wizard state
// ---------------------------------------------------------------------------

export interface WizardEventData {
  // Basic Info
  event_name: string;
  event_date: string; // YYYY-MM-DD
  location: string;
  location_type: "in-person" | "virtual" | "hybrid";
  slug: string;
  cover_image_url: string;
  cover_image_file?: File;

  // Content
  event_blurb: string;
  event_description: string;
  event_type: string[];

  // Submission Window
  submission_time_start: string; // ISO 8601
  submission_time_cutoff: string; // ISO 8601
  timezone: string;

  // Capacity & Pricing
  participant_capacity: number | null;
  paid: boolean;
  stripe_price_id: string;

  // Schedule
  schedule: WizardScheduleDay[];

  // Content Sections
  faqs: WizardFAQItem[];
  rules: WizardRuleSection[];
  resources: WizardResource[];
  gallery: WizardGalleryImage[];

  // Submission Form
  submission_fields: WizardSubmissionField[];
  max_team_size: number | null;
  allow_multiple_tracks: boolean;

  // Tracks & Judging
  tracks: WizardTrack[];

  // Access & Invites
  participant_invite_emails: string[];
  judge_invite_emails: string[];
  organizer_emails: string[];
  visibility: EventVisibility;
}

// ---------------------------------------------------------------------------
// Step component interface — every step uses this contract
// ---------------------------------------------------------------------------

export interface WizardStepProps {
  event: WizardEventData;
  setEvent: React.Dispatch<React.SetStateAction<WizardEventData>>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const INITIAL_WIZARD_EVENT: WizardEventData = {
  event_name: "",
  event_date: "",
  location: "",
  location_type: "in-person",
  slug: "",
  cover_image_url: "",
  event_blurb: "",
  event_description: "",
  event_type: ["hackathon"],
  submission_time_start: "",
  submission_time_cutoff: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  participant_capacity: null,
  paid: false,
  stripe_price_id: "",
  schedule: [],
  faqs: [],
  rules: [],
  resources: [],
  gallery: [],
  submission_fields: [],
  max_team_size: null,
  allow_multiple_tracks: false,
  tracks: [],
  participant_invite_emails: [],
  judge_invite_emails: [],
  organizer_emails: [],
  visibility: EventVisibility.Draft,
};

// ---------------------------------------------------------------------------
// Slug helper
// ---------------------------------------------------------------------------

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// buildApiPayload — convert wizard state → POST /api/events body
// ---------------------------------------------------------------------------

export interface EventApiPayload {
  event: {
    event_name: string;
    event_date: string;
    location: string;
    event_type?: string[];
    slug?: string;
    cover_image_url?: string;
    event_blurb?: string;
    event_description?: string;
    submission_time_start?: string;
    submission_time_cutoff?: string;
    participant_capacity?: number;
    visibility?: string;
    featured?: boolean;
    event_schedule?: {
      date: string;
      events: { name: string; time?: string; description?: string; guests?: string }[];
    }[];
    event_resources?: { name: string; link: string }[];
    rules?: { title: string; items: string[] }[];
    faq?: { question: string; answer: string }[];
    paid?: boolean;
    stripe_price_id?: string;
    tracks?: {
      client_id: string;
      name: string;
      description?: string | null;
      scoring_criteria?: {
        name: string;
        criteria: {
          id: string;
          name: string;
          description: string;
          weight?: number;
          min?: number;
          max?: number;
          type?: "numeric" | "multiplechoice";
          options?: string[];
        }[];
      };
    }[];
    prizes?: {
      track_client_id: string;
      name: string;
      description?: string;
      cover_image_url?: string;
    }[];
  };
  participantInviteEmails?: string[];
  judgeInviteEmails?: string[];
  organizerEmails?: string[];
}

export function buildApiPayload(event: WizardEventData): EventApiPayload {
  const payload: EventApiPayload = {
    event: {
      event_name: event.event_name,
      event_date: event.event_date,
      location: event.location,
      visibility: event.visibility,
    },
  };

  const e = payload.event;

  // Optional string fields — only include if non-empty
  if (event.slug) e.slug = event.slug;
  if (event.cover_image_url) e.cover_image_url = event.cover_image_url;
  if (event.event_blurb) e.event_blurb = event.event_blurb;
  if (event.event_description) e.event_description = event.event_description;
  if (event.submission_time_start)
    e.submission_time_start = event.submission_time_start;
  if (event.submission_time_cutoff)
    e.submission_time_cutoff = event.submission_time_cutoff;
  if (event.participant_capacity)
    e.participant_capacity = event.participant_capacity;
  if (event.event_type) e.event_type = event.event_type;

  // Pricing
  if (event.paid) {
    e.paid = true;
    if (event.stripe_price_id) e.stripe_price_id = event.stripe_price_id;
  }

  // Schedule — strip ids for API
  if (event.schedule.length > 0) {
    e.event_schedule = event.schedule.map((day) => ({
      date: day.date,
      events: day.events.map((ev) => ({
        name: ev.name,
        time: ev.time || undefined,
        description: ev.description || undefined,
        guests: ev.guests || undefined,
      })),
    }));
  }

  // FAQs — strip ids
  if (event.faqs.length > 0) {
    e.faq = event.faqs.map((f) => ({
      question: f.question,
      answer: f.answer,
    }));
  }

  // Rules — strip ids
  if (event.rules.length > 0) {
    e.rules = event.rules.map((r) => ({
      title: r.title,
      items: r.items,
    }));
  }

  // Resources — strip ids
  if (event.resources.length > 0) {
    e.event_resources = event.resources.map((r) => ({
      name: r.name,
      link: r.link,
    }));
  }

  // Tracks — convert inline structure to API format
  if (event.tracks.length > 0) {
    e.tracks = event.tracks.map((t) => ({
      client_id: t.client_id,
      name: t.name,
      description: t.description || null,
      scoring_criteria:
        t.criteria.length > 0
          ? {
              name: t.name,
              criteria: t.criteria.map((c) => ({
                id: c.id,
                name: c.name,
                description: c.description,
                weight: c.weight,
                min: c.min,
                max: c.max,
                type: c.type,
                options: c.options,
              })),
            }
          : undefined,
    }));

    // Prizes — flatten from tracks into separate array
    const prizes = event.tracks.flatMap((t) =>
      t.prizes.map((p) => ({
        track_client_id: t.client_id,
        name: p.name,
        description: p.description || undefined,
        cover_image_url: p.cover_image_url || undefined,
      }))
    );
    if (prizes.length > 0) {
      e.prizes = prizes;
    }
  }

  if ((event.participant_invite_emails ?? []).length > 0) {
    payload.participantInviteEmails = event.participant_invite_emails;
  }

  if ((event.judge_invite_emails ?? []).length > 0) {
    payload.judgeInviteEmails = event.judge_invite_emails;
  }

  // Organizer emails
  if ((event.organizer_emails ?? []).length > 0) {
    payload.organizerEmails = event.organizer_emails;
  }

  return payload;
}

// ---------------------------------------------------------------------------
// applyScrapedData — map scraper output → WizardEventData
// ---------------------------------------------------------------------------

export function applyScrapedData(
  scraped: Record<string, unknown>,
  current: WizardEventData
): WizardEventData {
  const updated = { ...current };

  // Direct string fields
  if (typeof scraped.event_name === "string")
    updated.event_name = scraped.event_name;
  if (typeof scraped.event_date === "string")
    updated.event_date = scraped.event_date;
  if (typeof scraped.location === "string") updated.location = scraped.location;
  if (typeof scraped.slug === "string") updated.slug = scraped.slug;
  if (typeof scraped.cover_image_url === "string")
    updated.cover_image_url = scraped.cover_image_url;
  if (typeof scraped.event_blurb === "string")
    updated.event_blurb = scraped.event_blurb;
  if (typeof scraped.event_description === "string")
    updated.event_description = scraped.event_description;
  if (typeof scraped.submission_time_start === "string")
    updated.submission_time_start = scraped.submission_time_start;
  if (typeof scraped.submission_time_cutoff === "string")
    updated.submission_time_cutoff = scraped.submission_time_cutoff;

  // Auto-derive slug from name if scraper didn't provide one
  if (!updated.slug && updated.event_name) {
    updated.slug = slugify(updated.event_name);
  }

  // Schedule
  if (Array.isArray(scraped.event_schedule)) {
    updated.schedule = (
      scraped.event_schedule as {
        date?: string;
        events?: { name?: string; time?: string; description?: string }[];
      }[]
    ).map((day, di) => ({
      date: day.date ?? `Day ${di + 1}`,
      events: (day.events ?? []).map((ev, ei) => ({
        id: `sched-${di}-${ei}`,
        name: ev.name ?? "",
        time: ev.time ?? "",
        description: ev.description ?? "",
      })),
    }));
  }

  // FAQs
  if (Array.isArray(scraped.faqs)) {
    updated.faqs = (
      scraped.faqs as { question?: string; answer?: string }[]
    ).map((f, i) => ({
      id: `faq-${i}`,
      question: f.question ?? "",
      answer: f.answer ?? "",
    }));
  }

  // Rules
  if (Array.isArray(scraped.rules)) {
    updated.rules = (
      scraped.rules as { title?: string; items?: string[] }[]
    ).map((r, i) => ({
      id: `rule-${i}`,
      title: r.title ?? "",
      items: r.items ?? [],
    }));
  }

  // Resources
  if (Array.isArray(scraped.event_resources)) {
    updated.resources = (
      scraped.event_resources as { name?: string; link?: string }[]
    ).map((r, i) => ({
      id: `res-${i}`,
      name: r.name ?? "",
      link: r.link ?? "",
    }));
  }

  // Tracks + Prizes
  if (Array.isArray(scraped.tracks)) {
    const scrapedTracks = scraped.tracks as Record<string, unknown>[];
    const scrapedPrizes = Array.isArray(scraped.prizes)
      ? (scraped.prizes as Record<string, unknown>[])
      : [];

    updated.tracks = scrapedTracks.map((t, ti) => {
      const clientId =
        (t.client_id as string) ??
        `track-${ti}-${slugify((t.name as string) ?? "track")}`;

      // Find prizes for this track
      const trackPrizes = scrapedPrizes
        .filter((p) => p.track_client_id === clientId)
        .map((p, pi) => ({
          id: `prize-${ti}-${pi}`,
          name: (p.name as string) ?? "",
          description: (p.description as string) ?? "",
          cover_image_url: (p.cover_image_url as string) ?? undefined,
        }));

      // Parse scoring criteria
      const scoringCriteria = t.scoring_criteria as
        | { criteria?: Record<string, unknown>[] }
        | undefined;
      const criteria = (scoringCriteria?.criteria ?? []).map((c, ci) => ({
        id: (c.id as string) ?? `crit-${ti}-${ci}`,
        name: (c.name as string) ?? "",
        description: (c.description as string) ?? "",
        type: ((c.type as string) ?? "numeric") as "numeric" | "multiplechoice",
        weight: (c.weight as number) ?? 1,
        min: (c.min as number) ?? 1,
        max: (c.max as number) ?? 10,
        options: c.options as string[] | undefined,
      }));

      return {
        client_id: clientId,
        name: (t.name as string) ?? "",
        description: (t.description as string) ?? "",
        label: (t.label as string) ?? undefined,
        prizes: trackPrizes,
        criteria,
      };
    });
  }

  return updated;
}
