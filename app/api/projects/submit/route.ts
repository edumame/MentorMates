import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/app/utils/supabase/server";
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
    const parsed = normalizeProjectWriteInput({
      ...body,
      leadEmail: body?.leadEmail ?? body?.lead_email ?? user.email ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await saveProjectSubmission(supabase, {
      input: parsed.data,
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
    console.error("Error in project submission:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
