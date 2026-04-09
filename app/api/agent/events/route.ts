import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
} from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { listManagedAgentEvents } from "@/lib/agent/event-access";
import { z } from "zod";

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
         event_prizes, scoring_config, cover_image_url, slug, paid,
         require_participant_approval, featured`
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

const updateEventSchema = z.object({
  event_name: z.string().min(1).max(200).optional(),
  event_description: z.string().max(5000).optional(),
  event_blurb: z.string().max(500).optional(),
  event_date: z.string().optional(),
  location: z.string().max(500).optional(),
  submission_time_start: z.string().nullable().optional(),
  submission_time_cutoff: z.string().nullable().optional(),
  participant_capacity: z.number().int().positive().nullable().optional(),
  require_participant_approval: z.boolean().optional(),
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
      .update(parsed.data)
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
