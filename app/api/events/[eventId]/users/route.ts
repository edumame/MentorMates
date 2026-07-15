import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";

const VALID_ROLES = new Set<string>([
  EventRole.Participant,
  EventRole.Mentor,
  EventRole.Judge,
  EventRole.Organizer,
  EventRole.Admin,
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const supabase = await createSupabaseClient();
    const serviceSupabase = createSupabaseServiceClient();
    const { eventId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: roleRow } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: isAdminRpc } = await supabase.rpc("is_admin_user", {
      user_id: user.id,
    });
    const isAdmin = Boolean(isAdminRpc);

    if (!roleRow && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const rolesParam = searchParams.get("roles");
    const requestedRoles = rolesParam
      ? rolesParam
          .split(",")
          .map((r) => r.trim())
          .filter((r) => VALID_ROLES.has(r))
      : [EventRole.Participant];

    if (requestedRoles.length === 0) {
      return NextResponse.json({ users: [], count: 0 }, { status: 200 });
    }

    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 100), 1),
      500
    );
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);
    const includeCount = searchParams.get("includeCount") === "true";

    const isOrganizer =
      roleRow &&
      canAccessRole(roleRow.role as EventRole, EventRole.Organizer);

    // Non-organizers can only request participant rows for their event.
    if (
      !isOrganizer &&
      !isAdmin &&
      requestedRoles.some((role) => role !== EventRole.Participant)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error, count } = await serviceSupabase
      .from("user_event_roles")
      .select(
        `
        user_id,
        role,
        user_profiles:user_id (
          uid,
          display_name,
          email,
          affiliation
        )
      `,
        { count: includeCount ? "exact" : undefined }
      )
      .eq("event_id", eventId)
      .in("role", requestedRoles)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch event users" },
        { status: 500 }
      );
    }

    const users = (data || []).map((row) => {
      const profile = Array.isArray(row.user_profiles)
        ? row.user_profiles[0]
        : row.user_profiles;

      return {
        user_id: row.user_id,
        role: row.role,
        uid: profile?.uid ?? row.user_id,
        display_name: profile?.display_name ?? "",
        email: profile?.email ?? "",
        affiliation: profile?.affiliation ?? "",
      };
    });

    return NextResponse.json({
      users,
      count: includeCount ? count || 0 : undefined,
    });
  } catch (error) {
    console.error("Error in GET /api/events/[eventId]/users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
