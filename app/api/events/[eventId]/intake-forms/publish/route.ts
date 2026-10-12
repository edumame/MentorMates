import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  INTAKE_FORM_CONTEXTS,
  type IntakeFormContext,
  type IntakeFormSchema,
} from "@/features/intake-forms/types";
import {
  getAuthContext,
  getOrCreateTemplateId,
} from "../_shared";

const publishSchema = z.object({
  context: z.enum(INTAKE_FORM_CONTEXTS),
  schema: z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      fields: z.array(z.any()),
    })
    .optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = publishSchema.safeParse(body);

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

    const { data: latestVersion } = await auth.supabase
      .from("intake_form_versions")
      .select("id, version_number, schema_json, published_at")
      .eq("form_template_id", templateId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    let targetVersionId: string;

    if (latestVersion?.id && !latestVersion.published_at) {
      const { data: publishedVersion, error: publishError } = await auth.supabase
        .from("intake_form_versions")
        .update({
          published_at: new Date().toISOString(),
          schema_json:
            (schema as unknown as Record<string, unknown> | undefined) ??
            latestVersion.schema_json,
          created_by: auth.user.id,
        })
        .eq("id", latestVersion.id)
        .select("id")
        .single();

      if (publishError || !publishedVersion?.id) {
        return NextResponse.json({ error: "Failed to publish form" }, { status: 500 });
      }

      targetVersionId = publishedVersion.id as string;
    } else if (latestVersion?.id && latestVersion.published_at) {
      if (schema) {
        const nextVersionNumber = (latestVersion.version_number ?? 0) + 1;
        const { data: newPublishedVersion, error: insertError } = await auth.supabase
          .from("intake_form_versions")
          .insert({
            form_template_id: templateId,
            version_number: nextVersionNumber,
            schema_json: schema as unknown as IntakeFormSchema,
            created_by: auth.user.id,
            published_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insertError || !newPublishedVersion?.id) {
          return NextResponse.json({ error: "Failed to publish form" }, { status: 500 });
        }

        targetVersionId = newPublishedVersion.id as string;
      } else {
        targetVersionId = latestVersion.id as string;
      }
    } else {
      if (!schema) {
        return NextResponse.json(
          { error: "No draft found. Save a draft before publishing." },
          { status: 400 }
        );
      }

      const { data: firstPublishedVersion, error: insertError } = await auth.supabase
        .from("intake_form_versions")
        .insert({
          form_template_id: templateId,
          version_number: 1,
          schema_json: schema as unknown as IntakeFormSchema,
          created_by: auth.user.id,
          published_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError || !firstPublishedVersion?.id) {
        return NextResponse.json({ error: "Failed to publish form" }, { status: 500 });
      }

      targetVersionId = firstPublishedVersion.id as string;
    }

    await auth.supabase
      .from("event_intake_form_bindings")
      .update({ is_active: false })
      .eq("event_id", eventId)
      .eq("context", context)
      .eq("is_active", true);

    const { error: bindingError } = await auth.supabase
      .from("event_intake_form_bindings")
      .insert({
        event_id: eventId,
        context,
        form_version_id: targetVersionId,
        is_active: true,
        created_by: auth.user.id,
      });

    if (bindingError) {
      return NextResponse.json(
        { error: "Form published, but binding failed" },
        { status: 500 }
      );
    }

    await auth.supabase
      .from("intake_form_templates")
      .update({ status: "published", description: schema?.description ?? null })
      .eq("id", templateId);

    const { data: publishedVersion } = await auth.supabase
      .from("intake_form_versions")
      .select("id, version_number, published_at, schema_json")
      .eq("id", targetVersionId)
      .single();

    return NextResponse.json({
      success: true,
      versionId: targetVersionId,
      lastPublished: publishedVersion
        ? {
            versionId: publishedVersion.id,
            versionNumber: publishedVersion.version_number,
            publishedAt: publishedVersion.published_at,
            schema: publishedVersion.schema_json as IntakeFormSchema,
          }
        : null,
    });
  } catch (error) {
    console.error("Error in POST /api/events/[eventId]/intake-forms/publish:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
