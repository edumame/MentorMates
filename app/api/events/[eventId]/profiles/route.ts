import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";

export async function POST(
  request: Request,
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
    const isOrganizer =
      roleRow &&
      canAccessRole(roleRow.role as EventRole, EventRole.Organizer);

    if (!isOrganizer && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await request.json().catch(() => ({}));
    const userIds = Array.isArray(payload.userIds)
      ? payload.userIds.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (userIds.length === 0) {
      return NextResponse.json({ profiles: [] });
    }

    const { data, error } = await serviceSupabase
      .from("user_event_roles")
      .select(
        `
        user_id,
        user_profiles:user_id (
          uid,
          display_name,
          email
        )
      `
      )
      .eq("event_id", eventId)
      .in("user_id", userIds);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch profiles" },
        { status: 500 }
      );
    }

    const profiles = (data || []).map((row) => {
      const profile = Array.isArray(row.user_profiles)
        ? row.user_profiles[0]
        : row.user_profiles;
      return {
        uid: profile?.uid || row.user_id,
        display_name: profile?.display_name || null,
        email: profile?.email || null,
      };
    });

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error("Error in POST /api/events/[eventId]/profiles:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
