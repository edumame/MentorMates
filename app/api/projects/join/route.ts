import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { verifyProjectInviteToken } from "@/lib/utils/jwt";

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseClient();
  const serviceSupabase = createSupabaseServiceClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, token } = await request.json();

  if (!projectId || !token) {
    return NextResponse.json(
      { error: "Missing projectId or token" },
      { status: 400 }
    );
  }

  const invite = await verifyProjectInviteToken(token);
  if (!invite || invite.projectId !== projectId) {
    return NextResponse.json(
      { error: "Invalid or expired invitation link" },
      { status: 401 }
    );
  }

  const userEmail = user.email?.toLowerCase();
  if (!userEmail) {
    return NextResponse.json(
      { error: "Authenticated account is missing an email address" },
      { status: 400 }
    );
  }

  if (invite.email.toLowerCase() !== userEmail) {
    return NextResponse.json(
      {
        error: `This invitation was sent to ${invite.email}. Please sign in with that account.`,
      },
      { status: 403 }
    );
  }

  const { data: project, error: projectError } = await serviceSupabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: projectError?.message || "Project not found" },
      { status: projectError ? 500 : 404 }
    );
  }

  const teammates = Array.isArray(project.teammates)
    ? project.teammates
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.toLowerCase())
    : [];
  const leadEmail =
    typeof project.lead_email === "string"
      ? project.lead_email.toLowerCase()
      : "";

  if (leadEmail === userEmail || teammates.includes(userEmail)) {
    return NextResponse.json({
      already_member: true,
      project,
    });
  }

  const { data: updatedProject, error: updateError } = await serviceSupabase
    .from("projects")
    .update({
      teammates: [...teammates, userEmail],
    })
    .eq("id", projectId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(updatedProject);
}
