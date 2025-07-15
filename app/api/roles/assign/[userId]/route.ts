//Assign a single judgee to a project
//interface should show which judges are assigned to which projects and how many judges are assigned to each project
//functionally a bilateral graph

import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";

export async function POST(
  req: Request,
  { params }: { params: { userId: string } }
) {
  const { projectId, role, eventId } = await req.json();
  const { userId } = params;

  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const { data: authRole } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("user_id", user?.id)
    .eq("event_id", eventId)
    .maybeSingle();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !authRole ||
    (authRole?.role !== EventRole.Admin &&
      authRole?.role !== EventRole.Organizer)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("project_assignments")
    .upsert(
      { project_id: projectId, user_id: userId, role: role, event_id: eventId },
    );

  if (error) {
    return NextResponse.json(
      { error: "Error assigning role" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Roles assigned successfully",
  });
}
