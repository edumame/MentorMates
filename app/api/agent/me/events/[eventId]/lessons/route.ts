import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
  resolveAgentPathEvent,
} from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parsePagination(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawLimit = searchParams.get("limit");
  const rawOffset = searchParams.get("offset");

  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : DEFAULT_LIMIT;
  const parsedOffset = rawOffset ? Number.parseInt(rawOffset, 10) : 0;

  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;
  const offset =
    Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  return { limit, offset };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const auth = await authenticateAgentRequest(request, {
      allowMissingEventId: true,
    });
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "participant-events:read");
    if (scopeError) return scopeError;

    const resolvedAuth = await resolveAgentPathEvent(auth, eventId);
    if (resolvedAuth instanceof NextResponse) return resolvedAuth;

    const access = await authorizeAgentEventAccess(
      resolvedAuth,
      EventRole.Participant
    );
    if (access instanceof NextResponse) return access;

    const { limit, offset } = parsePagination(request);

    const supabase = createSupabaseServiceClient();
    const { data, error, count } = await supabase
      .from("event_lessons")
      .select(
        "id, event_id, title, description, url, cover_image_url, duration_minutes, created_at, updated_at",
        { count: "exact" }
      )
      .eq("event_id", resolvedAuth.eventId)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      lessons: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Participant agent lessons GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
