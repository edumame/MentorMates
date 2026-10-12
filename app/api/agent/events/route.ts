import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
} from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { listManagedAgentEvents } from "@/lib/agent/event-access";
import { z } from "zod";
import type { Database, Json } from "@/lib/database.types";
import { randomUUID } from "crypto";

const DEFAULT_EVENT_LIST_LIMIT = 20;
const MAX_EVENT_LIST_LIMIT = 100;

function parsePaginationParam(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function listEditableEvents(request: NextRequest, userId: string) {
  const rawLimit = parsePaginationParam(
    request.nextUrl.searchParams.get("limit"),
    DEFAULT_EVENT_LIST_LIMIT
  );
  const rawOffset = parsePaginationParam(
    request.nextUrl.searchParams.get("offset"),
    0
  );
  const limit = Math.min(Math.max(rawLimit, 1), MAX_EVENT_LIST_LIMIT);
  const offset = Math.max(rawOffset, 0);
  const uniqueEvents = await listManagedAgentEvents(userId);

  return NextResponse.json({
    message: "event_id or event_slug query parameter is required for reusable keys",
    requires_event_id: true,
    events: uniqueEvents.slice(offset, offset + limit).map((event) => ({
      event_id: event.event_id,
      event_name: event.event_name,
    })),
    total: uniqueEvents.length,
    limit,
    offset,
  });
}

// GET: Get event details
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request, {
      allowMissingEventId: true,
    });
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "event:read");
    if (scopeError) return scopeError;

    if (!auth.eventId) {
      return listEditableEvents(request, auth.userId);
    }

    const access = await authorizeAgentEventAccess(auth);
    if (access instanceof NextResponse) return access;

    const supabase = createSupabaseServiceClient();

    const { data: event, error } = await supabase
      .from("events")
      .select(
        `event_id, event_name, event_date, event_blurb, event_description,
         location, visibility, approval_status, participant_capacity,
         submission_time_start, submission_time_cutoff, event_schedule,
         event_prizes, event_resources, scoring_config, cover_image_url, slug,
         paid, require_participant_approval,
         finalist_recommendation_enabled, featured, event_type, rules, faq,
         role_labels`
      )
      .eq("event_id", auth.eventId)
      .single();

    if (error || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Get participant/role counts
    const { data: roleCounts } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", auth.eventId);

    const counts = {
      participants: 0,
      mentors: 0,
      judges: 0,
      organizers: 0,
      total: roleCounts?.length || 0,
    };

    roleCounts?.forEach((r) => {
      if (r.role === "participant") counts.participants++;
      else if (r.role === "mentor") counts.mentors++;
      else if (r.role === "judge") counts.judges++;
      else if (r.role === "organizer") counts.organizers++;
    });

    // Get project count
    const { count: projectCount } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("event_id", auth.eventId);

    // Get pending approval request count
    const { count: pendingApprovals } = await supabase
      .from("participant_approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("event_id", auth.eventId)
      .eq("status", "pending");

    return NextResponse.json({
      event,
      counts,
      projects_count: projectCount || 0,
      pending_approvals: pendingApprovals || 0,
    });
  } catch (error) {
    console.error("Agent events GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Shared shapes (kept aligned with createEventSchema below). Each nested
// shape is .strict() so injected fields on JSONB structures are rejected.
const prizeShape = z
  .object({
    track: z.string(),
    prize: z.string(),
    description: z.string().optional(),
  })
  .strict();
const faqShape = z
  .object({ question: z.string(), answer: z.string() })
  .strict();
const ruleShape = z
  .object({ title: z.string(), items: z.array(z.string()) })
  .strict();
const resourceShape = z
  .object({ name: z.string(), link: z.string().url() })
  .strict();

// URL-safe slug: alphanumeric + hyphen/underscore only. Blocks path traversal,
// whitespace, and special characters.
const slugPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

// Organizer-writable fields. Admin-only fields (approval_status, rejection_reason,
// featured) and immutable fields (event_id, owner_id, created_at) are intentionally
// excluded and rejected via .strict(). `archived` visibility is excluded: archive
// flow goes through the dedicated web route that performs additional bookkeeping.
const updateEventSchema = z
  .object({
    // text
    event_name: z.string().min(1).max(200).optional(),
    event_description: z.string().max(5000).optional(),
    event_blurb: z.string().max(500).optional(),
    event_date: z.string().optional(),
    location: z.string().max(500).optional(),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(slugPattern, {
        message:
          "Slug must start with a letter/digit and contain only letters, digits, hyphens, or underscores",
      })
      .optional(),
    cover_image_url: z.string().url().nullable().optional(),
    // temporal
    submission_time_start: z.string().nullable().optional(),
    submission_time_cutoff: z.string().nullable().optional(),
    // booleans
    require_participant_approval: z.boolean().optional(),
    finalist_recommendation_enabled: z.boolean().optional(),
    paid: z.boolean().optional(),
    // numerics
    participant_capacity: z.number().int().positive().nullable().optional(),
    // enums (excluding "archived" — see comment above)
    visibility: z
      .enum(["draft", "private", "public", "demo", "test"])
      .optional(),
    // arrays / jsonb structures
    event_type: z.array(z.string()).optional(),
    event_prizes: z.array(prizeShape).optional(),
    event_schedule: z.array(z.record(z.string(), z.unknown())).optional(),
    event_resources: z.array(resourceShape).optional(),
    rules: z.array(ruleShape).optional(),
    faq: z.array(faqShape).optional(),
    role_labels: z.record(z.string(), z.unknown()).nullable().optional(),
    scoring_config: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

// PATCH: Update event details
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "event:write");
    if (scopeError) return scopeError;

    const access = await authorizeAgentEventAccess(auth);
    if (access instanceof NextResponse) return access;

    const body = await request.json();
    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();

    const { data: event, error } = await supabase
      .from("events")
      .update(parsed.data as Database["public"]["Tables"]["events"]["Update"])
      .eq("event_id", auth.eventId)
      .select("event_id, event_name")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error("Agent events PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// --- POST: Create a new event ---

const createEventSchema = z.object({
  event_name: z.string().min(3).max(200),
  event_date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "Invalid event_date — expected ISO date string (e.g. 2026-04-15)",
  }),
  location: z.string().min(1).max(500),
  event_description: z.string().max(5000).optional(),
  event_blurb: z.string().max(500).optional(),
  visibility: z
    .enum(["draft", "private", "public", "demo", "test"])
    .optional()
    .default("draft"),
  slug: z.string().min(1).max(100).optional(),
  submission_time_start: z.string().nullable().optional(),
  submission_time_cutoff: z.string().nullable().optional(),
  participant_capacity: z.number().int().positive().nullable().optional(),
  require_participant_approval: z.boolean().optional().default(false),
  event_type: z.array(z.string()).optional().default([]),
  paid: z.boolean().optional().default(false),
  event_schedule: z.array(z.record(z.string(), z.unknown())).optional(),
  event_prizes: z
    .array(
      z.object({
        track: z.string(),
        prize: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
  faq: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    )
    .optional(),
  rules: z
    .array(
      z.object({
        title: z.string(),
        items: z.array(z.string()),
      })
    )
    .optional(),
  tracks: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        scoring_criteria: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request, {
      allowMissingEventId: true,
    });
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "event:write");
    if (scopeError) return scopeError;

    const body = await request.json();
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const event = parsed.data;
    const supabase = createSupabaseServiceClient();

    // Build the insert payload
    const insertPayload: Database["public"]["Tables"]["events"]["Insert"] = {
      event_name: event.event_name,
      event_date: event.event_date,
      location: event.location,
      rules: ((event.rules ?? []) as unknown as Json),
      visibility:
        event.visibility as Database["public"]["Enums"]["event_visibility"],
      slug: event.slug ?? null,
      event_description: event.event_description ?? null,
      event_blurb: event.event_blurb ?? null,
      submission_time_start: event.submission_time_start ?? null,
      submission_time_cutoff: event.submission_time_cutoff ?? null,
      participant_capacity: event.participant_capacity ?? null,
      paid: event.paid ?? false,
      event_schedule: (event.event_schedule as Json) ?? null,
      event_prizes: (event.event_prizes as Json) ?? null,
      faq: (event.faq as Json) ?? null,
      owner_id: auth.userId,
      approval_status: "not_submitted",
      featured: false,
      event_type: event.event_type ?? [],
    };

    const { data: createdEvent, error: insertError } = await supabase
      .from("events")
      .insert(insertPayload)
      .select("event_id, event_name, event_date, visibility, slug")
      .single();

    if (insertError || !createdEvent) {
      console.error("Error creating event:", insertError);
      return NextResponse.json(
        { error: "Failed to create event" },
        { status: 500 }
      );
    }

    // Assign the creator as organizer
    const { error: roleError } = await supabase
      .from("user_event_roles")
      .upsert(
        {
          user_id: auth.userId,
          event_id: createdEvent.event_id,
          role: "organizer",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,event_id" }
      );

    if (roleError) {
      console.error("Error assigning organizer role:", roleError);
    }

    // Create tracks if provided
    const tracksCreated: string[] = [];
    if (event.tracks && event.tracks.length > 0) {
      const trackInserts: Database["public"]["Tables"]["event_tracks"]["Insert"][] =
        event.tracks.map((track) => {
          const trackId = randomUUID();
          tracksCreated.push(track.name);
          return {
            track_id: trackId,
            event_id: createdEvent.event_id,
            name: track.name,
            description: track.description ?? null,
            scoring_criteria: (track.scoring_criteria as Json) ?? null,
            updated_at: new Date().toISOString(),
          };
        });

      const { error: trackError } = await supabase
        .from("event_tracks")
        .insert(trackInserts);

      if (trackError) {
        console.error("Error creating tracks:", trackError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        event: createdEvent,
        tracks_created: tracksCreated,
        message: `Event "${createdEvent.event_name}" created successfully. You are now the organizer.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Agent events POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
