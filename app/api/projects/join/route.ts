import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { verifyProjectInviteToken } from "@/lib/utils/jwt";

const INVALID_INVITE_MESSAGE =
  "This invitation link is invalid or has expired. Please request a new one.";

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const projectId = body?.projectId;
  const token = body?.token;

  if (typeof projectId !== "string" || !projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const invite =
    typeof token === "string" && token
      ? await verifyProjectInviteToken(token)
      : null;

  if (!invite || invite.projectId !== projectId) {
    return NextResponse.json({ error: INVALID_INVITE_MESSAGE }, { status: 403 });
  }

  // Copied invite links are signed with no email, so anyone holding one can use
  // it until it expires. Emailed invites only work for the invited address.
  const userEmail = user.email.toLowerCase();
  if (invite.email && invite.email.toLowerCase() !== userEmail) {
    return NextResponse.json(
      { error: `This invitation was sent to ${invite.email}.` },
      { status: 403 }
    );
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { data: project, error: projectError } = await serviceSupabase
    .from("projects")
    .select("id, lead_email, teammates, event_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    console.error("Error loading project:", projectError);
    return NextResponse.json({ error: "Failed to join project" }, { status: 500 });
  }

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const teammates = project.teammates ?? [];
  const isMember =
    project.lead_email?.toLowerCase() === userEmail ||
    teammates.some((teammate) => teammate.toLowerCase() === userEmail);

  if (isMember) {
    return NextResponse.json(
      { error: "You are already a member of this project" },
      { status: 409 }
    );
  }

  if (project.event_id) {
    const { data: eventRole, error: eventRoleError } = await serviceSupabase
      .from("user_event_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("event_id", project.event_id)
      .maybeSingle();

    if (eventRoleError) {
      console.error("Error loading event role:", eventRoleError);
      return NextResponse.json({ error: "Failed to join project" }, { status: 500 });
    }

    if (!eventRole) {
      return NextResponse.json(
        { error: "You must be registered for the event to join this project" },
        { status: 403 }
      );
    }
  }

  const { error: updateError } = await serviceSupabase
    .from("projects")
    .update({ teammates: [...teammates, user.email] })
    .eq("id", projectId);

  if (updateError) {
    console.error("Error joining project:", updateError);
    return NextResponse.json({ error: "Failed to join project" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
