import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAgentRequest,
  authorizeAgentEventAccess,
  requireScope,
} from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { z } from "zod";

// event_lessons is not yet in generated Database types (migration landed after
// last regeneration). Insert shape mirrors the migration at
// supabase/migrations/20251021_create_event_lessons_table.sql.
type LessonInsert = {
  event_id: string;
  title: string;
  url: string;
  cover_image_url: string;
  description: string;
  duration_minutes: number;
};

// Shared shape for lesson body validation. `title`, `url`, `cover_image_url`,
// `description`, `duration_minutes` are NOT NULL in the event_lessons table
// (see supabase/migrations/20251021_create_event_lessons_table.sql).
const lessonCreateSchema = z
  .object({
    title: z.string().min(1).max(500),
    url: z.string().url(),
    cover_image_url: z.string().url(),
    description: z.string().min(1),
    duration_minutes: z.number().int().positive(),
  })
  .strict();

const lessonUpdateSchema = z
  .object({
    lesson_id: z.string().uuid(),
    title: z.string().min(1).max(500).optional(),
    url: z.string().url().optional(),
    cover_image_url: z.string().url().optional(),
    description: z.string().min(1).optional(),
    duration_minutes: z.number().int().positive().optional(),
  })
  .strict();

// GET: list lessons for the event
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "event:read");
    if (scopeError) return scopeError;

    const access = await authorizeAgentEventAccess(auth);
    if (access instanceof NextResponse) return access;

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("event_lessons")
      .select("*")
      .eq("event_id", auth.eventId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Agent lessons GET error:", error);
      return NextResponse.json({ error: "Failed to list lessons" }, { status: 500 });
    }

    return NextResponse.json({ lessons: data ?? [] });
  } catch (error) {
    console.error("Agent lessons GET unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: create a lesson
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "event:write");
    if (scopeError) return scopeError;

    const access = await authorizeAgentEventAccess(auth);
    if (access instanceof NextResponse) return access;

    const body = await request.json();
    const parsed = lessonCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();
    const insertPayload: LessonInsert = {
      ...parsed.data,
      event_id: auth.eventId!,
    };

    const { data, error } = await supabase
      .from("event_lessons")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      console.error("Agent lessons POST error:", error);
      return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });
    }

    return NextResponse.json({ success: true, lesson: data }, { status: 201 });
  } catch (error) {
    console.error("Agent lessons POST unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: update a lesson
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "event:write");
    if (scopeError) return scopeError;

    const access = await authorizeAgentEventAccess(auth);
    if (access instanceof NextResponse) return access;

    const body = await request.json();
    const parsed = lessonUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { lesson_id, ...updates } = parsed.data;
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from("event_lessons")
      .update(updates)
      .eq("id", lesson_id)
      .eq("event_id", auth.eventId)
      .select("*")
      .single();

    if (error) {
      console.error("Agent lessons PATCH error:", error);
      return NextResponse.json({ error: "Failed to update lesson" }, { status: 500 });
    }

    return NextResponse.json({ success: true, lesson: data });
  } catch (error) {
    console.error("Agent lessons PATCH unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: remove a lesson (lesson_id via query string)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "event:write");
    if (scopeError) return scopeError;

    const access = await authorizeAgentEventAccess(auth);
    if (access instanceof NextResponse) return access;

    const lessonId = request.nextUrl.searchParams.get("lesson_id");
    if (!lessonId) {
      return NextResponse.json(
        { error: "lesson_id query parameter is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from("event_lessons")
      .delete()
      .eq("id", lessonId)
      .eq("event_id", auth.eventId);

    if (error) {
      console.error("Agent lessons DELETE error:", error);
      return NextResponse.json({ error: "Failed to delete lesson" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Agent lessons DELETE unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
