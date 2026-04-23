import { verifyProjectInviteToken } from "@/lib/utils/jwt";
import { NextResponse } from "next/server";

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
  });
}
