import { createSupabaseClient } from "@/app/utils/supabase/server";
import { EventRole } from "@/lib/types";
import { canAccessRole } from "@/features/user/roles/roles";
import type { IntakeFormContext } from "@/features/intake-forms/types";

export function getTemplateName(context: IntakeFormContext) {
  return `intake_form_${context}`;
}

export async function getAuthContext(eventId: string) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase, user: null, isOrganizer: false, isAdmin: false };
  }

  const [{ data: roleRow }, { data: isAdminRpc }] = await Promise.all([
    supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.rpc("is_admin_user", { user_id: user.id }),
  ]);

  const isOrganizer = Boolean(
    roleRow && canAccessRole(roleRow.role as EventRole, EventRole.Organizer)
  );

  return {
    supabase,
    user,
    isOrganizer,
    isAdmin: Boolean(isAdminRpc),
  };
}

export async function getOrCreateTemplateId({
  supabase,
  eventId,
  userId,
  context,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>;
  eventId: string;
  userId: string;
  context: IntakeFormContext;
}) {
  const templateName = getTemplateName(context);

  const { data: existingTemplate } = await supabase
    .from("intake_form_templates")
    .select("id")
    .eq("event_id", eventId)
    .eq("name", templateName)
    .maybeSingle();

  if (existingTemplate?.id) {
    return existingTemplate.id as string;
  }

  const { data: newTemplate, error } = await supabase
    .from("intake_form_templates")
    .insert({
      event_id: eventId,
      created_by: userId,
      name: templateName,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !newTemplate?.id) {
    throw new Error("Failed to create intake form template");
  }

  return newTemplate.id as string;
}
