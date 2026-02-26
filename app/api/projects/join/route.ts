import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseClient } from "@/app/utils/supabase/server";

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

  const { projectId } = await request.json();

  const { data: project, error: projectError } = await serviceSupabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  const { data: updatedProject, error: updateError } = await serviceSupabase
    .from("projects")
    .update({
      teammates: [...project.teammates, user.email],
    })
    .eq("id", projectId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(updatedProject);
}
