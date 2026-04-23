import { createSupabaseClient } from "@/app/utils/supabase/server";
import { generateProjectInviteToken } from "@/lib/utils/jwt";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, inviteeEmail } = await request.json();

  if (!projectId) {
    return NextResponse.json(
      { error: "Missing projectId" },
      { status: 400 }
    );
  }

  // Fetch project details to verify user has permission
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, lead_email, teammates")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Get user email from profile
  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("email")
    .eq("uid", auth.user.id)
    .single();

  const userEmail = userProfile?.email;

  // Verify user has permission (is project lead or teammate)
  const isProjectLead = project.lead_email === userEmail;
  const isTeammate = project.teammates?.includes(userEmail || "");

  if (!isProjectLead && !isTeammate) {
    return NextResponse.json(
      { error: "Forbidden: Only project lead or teammates can generate invite links" },
      { status: 403 }
    );
  }

  try {
    // Generate JWT token with 10-minute expiry
    const token = await generateProjectInviteToken(
      {
        email: inviteeEmail || "",
        projectId,
        invitedBy: userEmail || auth.user.id,
      },
      600 // 10 minutes
    );

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Error generating token:", error);
    return NextResponse.json(
      { error: "Failed to generate invite token" },
      { status: 500 }
    );
  }
}
