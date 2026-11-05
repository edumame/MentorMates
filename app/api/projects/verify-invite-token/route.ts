import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { verifyProjectInviteToken } from "@/lib/utils/jwt";
import { NextResponse } from "next/server";

/**
 * RLS hides private projects from invitees who are logged out or have no event
 * role, so the join page cannot read them. This runs only after the token is
 * verified, and the caller may be anonymous: never add member emails here.
 *
 * A failed lookup returns null instead of failing the request, because the
 * token is still valid and the page may already have the project through RLS.
 */
async function getInvitePreview(projectId: string) {
  try {
    const { data, error } = await createSupabaseServiceClient()
      .from("projects")
      .select(
        `
        id,
        project_name,
        project_description,
        lead_name,
        event_id,
        event:events(
          event_name,
          event_date
        )
      `
      )
      .eq("id", projectId)
      .maybeSingle();

    if (error) {
      console.error("Failed to load invite preview:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    const event = Array.isArray(data.event) ? data.event[0] : data.event;
    return { ...data, event: event ?? null };
  } catch (error) {
    console.error("Failed to load invite preview:", error);
    return null;
  }
}

export async function POST(request: Request) {
  const { token, projectId } = await request.json();

  if (!token || !projectId) {
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

  return NextResponse.json({
    valid: true,
    email: payload.email,
    invitedBy: payload.invitedBy,
    project: await getInvitePreview(projectId),
  });
}
