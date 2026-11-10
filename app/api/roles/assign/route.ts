// Auto-assign judges or mentors to the event's submitted projects.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";

const bodySchema = z.object({
  eventId: z.string().uuid(),
  role: z.enum([EventRole.Judge, EventRole.Mentor]),
  rolesPerProject: z.number().int().min(1).max(50),
  // JUDGE-008: the Assign Roles tab can put organizers into the pool.
  includeOrganizers: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { eventId, role, rolesPerProject, includeOrganizers } = parsed.data;

  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // JUDGE-008: permission (can_manage_event: owner, organizer, global admin),
  // pool/project selection, delete and insert all happen in one transaction,
  // serialized per event, inside public.auto_assign_event_roles
  // (supabase/migrations/202611080405_c_round2.sql).
  const { data, error } = await supabase.rpc("auto_assign_event_roles", {
    p_event_id: eventId,
    p_role: role,
    p_per_project: rolesPerProject,
    p_include_organizers: includeOrganizers,
  });

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error.code === "28000") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const notEnough = /^not_enough_roles:(\d+)$/.exec(error.message ?? "");
    if (notEnough) {
      const available = Number(notEnough[1]);
      return NextResponse.json(
        {
          error: `Only ${available} ${role}${available === 1 ? "" : "s"} available; lower the number per project to ${Math.max(1, available)} or fewer.`,
        },
        { status: 400 }
      );
    }
    console.error("Error auto-assigning roles:", error);
    return NextResponse.json(
      { error: "Failed to save assignments. Existing assignments were kept." },
      { status: 500 }
    );
  }

  const result = (data ?? {}) as { assigned?: number; projects?: number; skipped?: boolean };
  if (result.skipped) {
    return NextResponse.json({
      success: true,
      skipped: true,
      assignedCount: 0,
      message: "No submitted projects yet; existing assignments were left unchanged.",
    });
  }

  return NextResponse.json({
    success: true,
    message: "Roles assigned successfully",
    assignedCount: result.assigned ?? 0,
  });
}
