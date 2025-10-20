//Auto assign judges or mentors to projects
//interface should show which judges are assigned to which projects and how many judges are assigned to each project
//functionally a bilateral graph

import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";
import { shuffle } from "@/lib/utils/shuffle";

export async function POST(req: Request) {
  const { eventId, role, rolesPerProject } = await req.json();

  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: authRole } = await supabase
    .from("user_event_roles")
    .select("role")
    .eq("user_id", user?.id)
    .eq("event_id", eventId)
    .maybeSingle();

  if (
    !authRole ||
    (authRole?.role !== EventRole.Admin &&
      authRole?.role !== EventRole.Organizer)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select(
      `
        id 
      `
    )
    .eq("event_id", eventId)
    .eq("submitted", true);

  if (projectsError) {
    return NextResponse.json(
      { error: "Error fetching projects" },
      { status: 500 }
    );
  }

  const projectIds = projects.map((project) => project.id);

  const { data: roleToAssign, error: roleToAssignError } = await supabase
    .from("user_event_roles")
    .select("user_id, role")
    .eq("event_id", eventId)
    .eq("role", role);

  
  // need a different algorithm for if the number of judges per project = number of judges

  // to ensure judges don't get assigned to the same project more than once, need to group them 
  
  if (roleToAssignError) {
    return NextResponse.json(
      { error: "Error fetching roles to assign" },
      { status: 500 }
    );
  }

  if (roleToAssign.length < rolesPerProject) {
    return NextResponse.json(
      { error: "Not enough roles to assign" },
      { status: 400 }
    );
  }

  // Shuffle to avoid bias
  const shuffledProjects = shuffle(projectIds);
  const userIdsToAssign = shuffle(roleToAssign.map((r) => r.user_id));

  // Assign groups of size rolesPerProject to each project using wrap-around (modulo)
  for (let pIndex = 0; pIndex < shuffledProjects.length; pIndex++) {
    const projectId = shuffledProjects[pIndex];

    for (let k = 0; k < rolesPerProject; k++) {
      const userIndex = (pIndex * rolesPerProject + k) % userIdsToAssign.length;
      const userId = userIdsToAssign[userIndex];

      await supabase
        .from("project_assignments")
        .upsert({
          project_id: projectId,
          user_id: userId,
          role: role,
          event_id: eventId,
        });
    }
  }

  return NextResponse.json({
    success: true,
    message: "Roles assigned successfully",
  });
}
