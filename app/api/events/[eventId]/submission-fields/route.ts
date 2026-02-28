import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { canAccessRole } from "@/features/user/roles/roles";
import { EventRole } from "@/lib/types";
import { submissionFieldTypeSchema } from "@/features/projects/utils/submission";

const fieldInputSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9_]+$/),
  label: z.string().trim().min(1).max(160),
  description: z.string().max(500).optional().nullable(),
  placeholder: z.string().max(250).optional().nullable(),
  field_type: submissionFieldTypeSchema,
  required: z.boolean().default(false),
  is_active: z.boolean().optional(),
});

const bodySchema = z.object({
  fields: z.array(fieldInputSchema).max(50),
});

const slugifyKey = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

async function getRoleContext(
  eventId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>
) {
  const [{ data: roleRow }, { data: isAdminRpc }] = await Promise.all([
    supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.rpc("is_admin_user", { user_id: userId }),
  ]);

  const isAdmin = Boolean(isAdminRpc);
  const role = roleRow?.role as EventRole | undefined;
  const hasEventRole = Boolean(role);
  const isOrganizer = Boolean(
    role && canAccessRole(role, EventRole.Organizer)
  );

  return { isAdmin, isOrganizer, hasEventRole };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const supabase = await createSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { isAdmin, isOrganizer, hasEventRole } = await getRoleContext(
      eventId,
      user.id,
      supabase
    );

    if (!isAdmin && !hasEventRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let query = supabase
      .from("event_submission_fields")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });

    if (!isAdmin && !isOrganizer) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch submission fields" },
        { status: 500 }
      );
    }

    return NextResponse.json({ fields: data || [] });
  } catch (error) {
    console.error("GET submission fields error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const supabase = await createSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { isAdmin, isOrganizer } = await getRoleContext(
      eventId,
      user.id,
      supabase
    );

    if (!isAdmin && !isOrganizer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const seenKeys = new Set<string>();
    const fields = parsed.data.fields.map((field, index) => {
      const fallbackKey = slugifyKey(field.label);
      const key = (field.key || fallbackKey).trim();
      if (!key) {
        throw new Error(`Field at index ${index + 1} requires a valid key`);
      }
      if (seenKeys.has(key)) {
        throw new Error(`Duplicate field key: ${key}`);
      }
      seenKeys.add(key);

      return {
        event_id: eventId,
        key,
        label: field.label.trim(),
        description: field.description?.trim() || null,
        placeholder: field.placeholder?.trim() || null,
        field_type: field.field_type,
        required: field.required,
        is_active: field.is_active ?? true,
        sort_order: index,
      };
    });

    // Step 1: deactivate existing fields for this event.
    const { error: deactivateError } = await supabase
      .from("event_submission_fields")
      .update({ is_active: false })
      .eq("event_id", eventId);

    if (deactivateError) {
      return NextResponse.json(
        { error: "Failed to update submission field state" },
        { status: 500 }
      );
    }

    // Step 2: upsert the current active configuration.
    if (fields.length > 0) {
      const { error: upsertError } = await supabase
        .from("event_submission_fields")
        .upsert(fields, { onConflict: "event_id,key" });

      if (upsertError) {
        return NextResponse.json(
          { error: "Failed to save submission fields" },
          { status: 500 }
        );
      }
    }

    const { data: updated, error: fetchError } = await supabase
      .from("event_submission_fields")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch updated submission fields" },
        { status: 500 }
      );
    }

    return NextResponse.json({ fields: updated || [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message.startsWith("Duplicate field key") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
