import { supabase } from "@/lib/supabase";
import { Project } from "@/lib/types";
import { PostgrestError } from "@supabase/supabase-js";
import { PROJECT_CLIENT_COLUMNS } from "@/lib/projects/columns";
import { getTeamEmails } from "@/lib/projects/membership";

// The email columns are not client-readable (`.select()` would ask for `*`
// and fail), so updates return the client-readable columns and the team
// emails are re-attached through project_team_emails (the editor is a team
// member or organizer).
async function withTeamEmails(
  data: Record<string, unknown> | null
): Promise<Project | null> {
  if (!data) return null;
  const id = String(data.id);
  const emails = (await getTeamEmails(supabase, [id])).get(id);
  return {
    ...data,
    lead_email: emails?.lead_email ?? "",
    teammates: emails?.teammates ?? [],
  } as unknown as Project;
}

export async function updateProjectClient(
  projectId: string,
  updateData: Partial<Project>
): Promise<{ data: Project | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("projects")
    .update(updateData)
    .eq("id", projectId)
    .select(PROJECT_CLIENT_COLUMNS)
    .single();

  if (error) return { data: null, error };
  return { data: await withTeamEmails(data as unknown as Record<string, unknown>), error: null };
}

export async function updateProjectTeamClient(
  projectId: string,
  teammates: string[]
): Promise<{ data: Project | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("projects")
    .update({ teammates })
    .eq("id", projectId)
    .select(PROJECT_CLIENT_COLUMNS)
    .single();

  if (error) return { data: null, error };
  return { data: await withTeamEmails(data as unknown as Record<string, unknown>), error: null };
}
