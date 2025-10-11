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

  const repeatedProjects = projectIds.flatMap((project) =>
    Array(rolesPerProject).fill(project)
  );
  const shuffledProjects = shuffle(repeatedProjects);

  const roleToProject: { [key: string]: string[] } = {};

  // Initialize arrays for each user
  roleToAssign.forEach((role) => {
    roleToProject[role.user_id] = [];
  });

  let roleIndex = 0;
  for (const project of shuffledProjects) {
    roleIndex = roleIndex % roleToAssign.length;
    roleToProject[roleToAssign[roleIndex].user_id].push(project);
    roleIndex++;
  }

  //kind of inefficient tbh
  for (const [roleId, projectIds] of Object.entries(roleToProject)) {
    for (const projectId of projectIds) {
      await supabase
        .from("project_assignments")
        .upsert({
          project_id: projectId,
          user_id: roleId,
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
