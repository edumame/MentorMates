import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { IntakeFormContext, IntakeFormSchema } from "@/features/intake-forms/types";
import {
  getAuthContext,
  getOrCreateTemplateId,
  getTemplateName,
} from "./_shared";

const querySchema = z.object({
  context: z.enum(["registration", "project_submission"]),
});

const saveSchema = z.object({
  context: z.enum(["registration", "project_submission"]),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    fields: z.array(z.any()),
  }),
});

async function getLatestVersion(
  supabase: Awaited<ReturnType<typeof getAuthContext>>["supabase"],
  templateId: string
) {
  const { data } = await supabase
    .from("intake_form_versions")
    .select("id, version_number, schema_json, published_at")
    .eq("form_template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

async function getLastPublishedVersion(
  supabase: Awaited<ReturnType<typeof getAuthContext>>["supabase"],
  templateId: string
) {
  const { data } = await supabase
    .from("intake_form_versions")
    .select("id, version_number, schema_json, published_at")
    .eq("form_template_id", templateId)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const parseResult = querySchema.safeParse({
      context: request.nextUrl.searchParams.get("context"),
    });

    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid context" }, { status: 400 });
    }

    const context = parseResult.data.context;
    const auth = await getAuthContext(eventId);

    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!auth.isOrganizer && !auth.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const templateName = getTemplateName(context);

    const { data: template } = await auth.supabase
      .from("intake_form_templates")
      .select("id")
      .eq("event_id", eventId)
      .eq("name", templateName)
      .maybeSingle();

    if (!template?.id) {
      return NextResponse.json({
        schema: {
          title: "Participant Intake Form",
          description: "Collect additional participant details",
          fields: [],
        } satisfies IntakeFormSchema,
        lastPublished: null,
      });
    }

    const latestVersion = await getLatestVersion(auth.supabase, template.id as string);
    const lastPublishedVersion = await getLastPublishedVersion(
      auth.supabase,
      template.id as string
    );

    if (!latestVersion?.schema_json) {
      return NextResponse.json({
        schema: {
          title: "Participant Intake Form",
          description: "Collect additional participant details",
          fields: [],
        } satisfies IntakeFormSchema,
        lastPublished: lastPublishedVersion
          ? {
              versionId: lastPublishedVersion.id,
              versionNumber: lastPublishedVersion.version_number,
              publishedAt: lastPublishedVersion.published_at,
              schema: lastPublishedVersion.schema_json as IntakeFormSchema,
            }
          : null,
      });
    }

    return NextResponse.json({
      schema: latestVersion.schema_json as IntakeFormSchema,
      versionId: latestVersion.id,
      publishedAt: latestVersion.published_at,
      versionNumber: latestVersion.version_number,
      lastPublished: lastPublishedVersion
        ? {
            versionId: lastPublishedVersion.id,
            versionNumber: lastPublishedVersion.version_number,
            publishedAt: lastPublishedVersion.published_at,
            schema: lastPublishedVersion.schema_json as IntakeFormSchema,
          }
        : null,
    });
  } catch (error) {
    console.error("Error in GET /api/events/[eventId]/intake-forms:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const parsed = saveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { context, schema } = parsed.data;
    const auth = await getAuthContext(eventId);

    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!auth.isOrganizer && !auth.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const templateId = await getOrCreateTemplateId({
      supabase: auth.supabase,
      eventId,
      userId: auth.user.id,
      context: context as IntakeFormContext,
    });

    const latestVersion = await getLatestVersion(auth.supabase, templateId);

    if (latestVersion?.id && !latestVersion.published_at) {
      const { data: updatedVersion, error } = await auth.supabase
        .from("intake_form_versions")
        .update({
          schema_json: schema,
          created_by: auth.user.id,
        })
        .eq("id", latestVersion.id)
        .select("id, version_number, published_at")
        .single();

      if (error) {
        return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
      }

      await auth.supabase
        .from("intake_form_templates")
        .update({ status: "draft", description: schema.description ?? null })
        .eq("id", templateId);

      return NextResponse.json({
        success: true,
        versionId: updatedVersion.id,
        versionNumber: updatedVersion.version_number,
        publishedAt: updatedVersion.published_at,
      });
    }

    const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

    const { data: insertedVersion, error: insertError } = await auth.supabase
      .from("intake_form_versions")
      .insert({
        form_template_id: templateId,
        version_number: nextVersionNumber,
        schema_json: schema,
        created_by: auth.user.id,
      })
      .select("id, version_number, published_at")
      .single();

    if (insertError) {
      return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
    }

    await auth.supabase
      .from("intake_form_templates")
      .update({ status: "draft", description: schema.description ?? null })
      .eq("id", templateId);

    return NextResponse.json({
      success: true,
      versionId: insertedVersion.id,
      versionNumber: insertedVersion.version_number,
      publishedAt: insertedVersion.published_at,
    });
  } catch (error) {
    console.error("Error in PUT /api/events/[eventId]/intake-forms:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const parseResult = querySchema.safeParse({
      context: request.nextUrl.searchParams.get("context"),
    });

    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid context" }, { status: 400 });
    }

    const context = parseResult.data.context;
    const auth = await getAuthContext(eventId);

    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!auth.isOrganizer && !auth.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const templateName = getTemplateName(context);
    const { data: template } = await auth.supabase
      .from("intake_form_templates")
      .select("id")
      .eq("event_id", eventId)
      .eq("name", templateName)
      .maybeSingle();

    // No-op is still success for idempotent UX.
    if (!template?.id) {
      return NextResponse.json({ success: true, deleted: false });
    }

    // Safe delete behavior:
    // 1) deactivate active binding so participants no longer see questionnaire
    // 2) archive template, preserving version/submission history
    const [{ error: deactivateError }, { error: archiveError }] = await Promise.all([
      auth.supabase
        .from("event_intake_form_bindings")
        .update({ is_active: false })
        .eq("event_id", eventId)
        .eq("context", context)
        .eq("is_active", true),
      auth.supabase
        .from("intake_form_templates")
        .update({ status: "archived" })
        .eq("id", template.id),
    ]);

    if (deactivateError || archiveError) {
      return NextResponse.json(
        { error: "Failed to delete questionnaire" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error("Error in DELETE /api/events/[eventId]/intake-forms:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
