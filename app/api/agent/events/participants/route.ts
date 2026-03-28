import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest, requireScope } from "@/lib/agent/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { z } from "zod";

// GET: List all participants (and other roles) for the event
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "participants:read");
    if (scopeError) return scopeError;

    const supabase = createSupabaseServiceClient();
    const role = request.nextUrl.searchParams.get("role"); // filter by role
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || "100"),
      500
    );
    const offset = parseInt(
      request.nextUrl.searchParams.get("offset") || "0"
    );

    let query = supabase
      .from("user_event_roles")
      .select(
        `
        id, user_id, role, created_at,
        user_profiles!user_event_roles_user_id_fkey1(
          uid, display_name, email, avatar_url, bio, affiliation
        )
      `,
        { count: "exact" }
      )
      .eq("event_id", auth.eventId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (role) {
      query = query.eq("role", role);
    }

    const { data: participants, error, count } = await query;

    if (error) {
      console.error("Error fetching participants:", error);
      return NextResponse.json(
        { error: "Failed to fetch participants" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      participants,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Agent participants GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const updateParticipantSchema = z.object({
  user_id: z.string().uuid(),
  action: z.enum(["change_role", "remove"]),
  role: z
    .enum(["participant", "mentor", "judge", "organizer"])
    .optional(),
});

// PATCH: Change a participant's role or remove them
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (auth instanceof NextResponse) return auth;

    const scopeError = requireScope(auth, "participants:write");
    if (scopeError) return scopeError;

    const body = await request.json();
    const parsed = updateParticipantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { user_id, action, role } = parsed.data;
    const supabase = createSupabaseServiceClient();

    if (action === "remove") {
      const { error } = await supabase
        .from("user_event_roles")
        .delete()
        .eq("event_id", auth.eventId)
        .eq("user_id", user_id);

      if (error) {
        return NextResponse.json(
          { error: "Failed to remove participant" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `User ${user_id} removed from event`,
      });
    }

    if (action === "change_role") {
      if (!role) {
        return NextResponse.json(
          { error: "role is required for change_role action" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("user_event_roles")
        .update({ role, updated_at: new Date().toISOString() })
        .eq("event_id", auth.eventId)
        .eq("user_id", user_id);

      if (error) {
        return NextResponse.json(
          { error: "Failed to update role" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `User ${user_id} role changed to ${role}`,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Agent participants PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
