import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";
import type { Database } from "@/lib/database.types";

type DbEventRole = Database["public"]["Enums"]["event_role"];

const MAX_PAGE_SIZE = 500;
const TEAM_LOOKUP_CHUNK = 100;

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const value = raw === null || raw.trim() === "" ? fallback : Math.trunc(Number(raw));
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

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
    const requestedRoles: DbEventRole[] = rolesParam
      ? rolesParam
          .split(",")
          .map((r) => r.trim())
          .filter((r): r is DbEventRole => VALID_ROLES.has(r))
      : ["participant"];

    if (requestedRoles.length === 0) {
      return NextResponse.json({ users: [], count: 0 }, { status: 200 });
    }

    // Paging contract (ORG-024): limit 1..500 (default 100), 0-based offset,
    // stable (created_at, user_id) order, includeCount=true returns the exact
    // total. Callers needing every row must page until a short page or count.
    const limit = clampInt(searchParams.get("limit"), 100, 1, MAX_PAGE_SIZE);
    const offset = clampInt(searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
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
      .order("user_id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch event users" },
        { status: 500 }
      );
    }

    // Team assignments live in team_members/teams (populated by event-day
    // team formation), not on the role rows — join them in per user.
    // Only this page's users; chunked so the id list stays well within URL
    // length limits for 500-row pages.
    const pageUserIds = (data || []).map((row) => row.user_id);
    const teamRows: Array<{ user_id: string; teams: unknown }> = [];
    for (let i = 0; i < pageUserIds.length; i += TEAM_LOOKUP_CHUNK) {
      const { data: chunkRows } = await serviceSupabase
        .from("team_members")
        .select("user_id, teams (name)")
        .eq("event_id", eventId)
        .in("user_id", pageUserIds.slice(i, i + TEAM_LOOKUP_CHUNK));
      teamRows.push(...(chunkRows || []));
    }

    const teamNameByUserId = new Map<string, string>();
    teamRows.forEach((row) => {
      const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
      const name = (team as { name?: string } | null)?.name?.trim();
      if (name && !teamNameByUserId.has(row.user_id)) {
        teamNameByUserId.set(row.user_id, name);
      }
    });

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
        team_name: teamNameByUserId.get(row.user_id) ?? "",
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
