import { verifyProjectInviteToken } from "@/lib/utils/jwt";
import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { token, projectId } = body && typeof body === "object" && !Array.isArray(body) ? body : {};

  if (typeof token !== "string" || !token || typeof projectId !== "string" || !projectId) {
    return NextResponse.json(
      { valid: false, error: "Missing token or projectId" },
      { status: 400 }
    );
  }

  const payload = await verifyProjectInviteToken(token);

  if (!payload) {
    return NextResponse.json(
      { valid: false, error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  // Verify the token is for this specific project
  if (payload.projectId !== projectId) {
    return NextResponse.json(
      { valid: false, error: "Token does not match project" },
      { status: 401 }
    );
  }

  const verification = {
    valid: true,
    email: payload.email,
    invitedBy: payload.invitedBy,
  };
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  // A bearer link alone must not reveal a private project's contents.
  if (!user) return NextResponse.json({ ...verification, project: null });
  if (payload.email && user.email?.toLowerCase() !== payload.email.toLowerCase()) {
    return NextResponse.json({ valid: false, error: "Please sign in with the email address this invitation was sent to." }, { status: 403 });
  }

  // Only the authenticated, token-bound invitee may preview before membership
  // exists. Ordinary project reads retain their existing RLS boundary.
  const service = createSupabaseServiceClient();
  const { data: project, error } = await service.from("projects")
    .select("id, project_name, project_description, lead_name, lead_email, teammates, event_id, created_at")
    .eq("id", projectId)
    .single();
  if (error || !project) {
    return NextResponse.json({ valid: false, error: "Project invitation is unavailable. Please try again or ask for a new invitation." }, { status: error && error.code !== "PGRST116" ? 503 : 404 });
  }
  const inviter = payload.invitedBy.toLowerCase();
  if (project.lead_email?.toLowerCase() !== inviter &&
      !project.teammates?.some(email => email.toLowerCase() === inviter)) {
    return NextResponse.json({ valid: false, error: "This invitation is no longer valid. Please request a new invitation." }, { status: 403 });
  }
  return NextResponse.json({ ...verification, project });
}
