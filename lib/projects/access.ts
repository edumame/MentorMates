import { EventRole } from "@/lib/types";
import type { ServiceSupabaseClient } from "@/lib/supabase/service";

export interface ProjectEditAccess {
  eventId: string | null;
  isLead: boolean;
  isTeammate: boolean;
  isOrganizer: boolean;
  canEdit: boolean;
}

export async function getProjectEditAccess(
  supabase: ServiceSupabaseClient,
  options: {
    projectId: string;
    userId: string;
    userEmail: string | null | undefined;
    allowOrganizer?: boolean;
  },
) {
  const { projectId, userId, userEmail, allowOrganizer = true } = options;

  const { data: project, error } = await supabase
    .from("projects")
    .select("event_id, lead_email, teammates")
    .eq("id", projectId)
    .maybeSingle()
    .overrideTypes<
      {
        event_id: string | null;
        lead_email: string | null;
        teammates: string[] | null;
      } | null
    >();

  if (error || !project) {
    return { access: null, error: "Project not found", status: 404 as const };
  }

  const normalizedUserEmail = userEmail?.trim().toLowerCase() || "";
  const teammateEmails = (project.teammates || []).map((teammate) =>
    teammate.trim().toLowerCase(),
  );

  let isOrganizer = false;
  if (allowOrganizer && project.event_id) {
    const { data: organizerRole } = await supabase
      .from("user_event_roles")
      .select("role")
      .eq("event_id", project.event_id)
      .eq("user_id", userId)
      .eq("role", EventRole.Organizer)
      .maybeSingle()
      .overrideTypes<{ role: EventRole } | null>();

    isOrganizer = Boolean(organizerRole);
  }

  const access: ProjectEditAccess = {
    eventId: project.event_id,
    isLead:
      normalizedUserEmail.length > 0 &&
      project.lead_email?.toLowerCase() === normalizedUserEmail,
    isTeammate:
      normalizedUserEmail.length > 0 &&
      teammateEmails.includes(normalizedUserEmail),
    isOrganizer,
    canEdit: false,
  };

  access.canEdit = access.isLead || access.isTeammate || access.isOrganizer;

  return { access, error: null, status: 200 as const };
}
