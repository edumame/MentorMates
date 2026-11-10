import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { getProjectEditAccess } from "@/lib/projects/access";
// Edit rights are derived from the verified user; the team email columns are
// not readable by client roles, so the lookup uses the service client.
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  normalizeProjectWriteInput,
  saveProjectSubmission,
} from "@/lib/projects/submission-service";

export async function POST(request: Request) {
  const supabase = await createSupabaseClient();

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!user || userError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = normalizeProjectWriteInput(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Updating an existing project requires the same edit rights as PATCH
    // /api/projects/[projectId] (PUB-011: public projects are readable by
    // anyone, so a non-member "update" used to look successful).
    if (parsed.data.projectId) {
      const accessResult = await getProjectEditAccess(createSupabaseServiceClient(), {
        projectId: parsed.data.projectId,
        userId: user.id,
        userEmail: user.email,
      });
      if (!accessResult.access) {
        return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
      }
      if (!accessResult.access.canEdit) {
        return NextResponse.json(
          { error: "You don't have permission to edit this project" },
          { status: 403 }
        );
      }
    }

    const result = await saveProjectSubmission(supabase, {
      // The caller only becomes lead of a project they create. Submitting an
      // existing project may be done by a teammate and must not reassign it.
      input: parsed.data.projectId
        ? parsed.data
        : {
            ...parsed.data,
            leadEmail: parsed.data.leadEmail ?? user.email ?? undefined,
          },
      mode: parsed.data.projectId ? "update" : "create",
      projectId: parsed.data.projectId,
      defaultSubmitted: true,
    });

    if ("error" in result) {
      return NextResponse.json(
        Object.fromEntries(
          Object.entries(result).filter(([key]) => !["status"].includes(key))
        ),
        { status: result.status }
      );
    }

    return NextResponse.json({ data: result.project });
  } catch (error) {
    console.error("[submit] unhandled exception in POST /api/projects/submit", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
