import { supabase } from "@/lib/supabase";
import { Project } from "@/lib/types";
import { applyTeammateChanges, type TeammateChanges } from "@/lib/projects/teammates";
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
  changes: TeammateChanges
): Promise<{ data: Project | null; error: PostgrestError | null }> {
  // teammates is not client-readable, so the fresh stored list comes from
  // project_team_emails. Read it directly (not via getTeamEmails, which
  // swallows errors) so a failed read can never be mistaken for an empty team.
  const { data: rows, error: readError } = await supabase.rpc("project_team_emails", {
    p_project_ids: [projectId],
  });

  if (readError) {
    return { data: null, error: readError };
  }

  const stored = ((rows ?? []) as Array<{ project_id: string; teammates: string[] | null }>).find(
    (row) => row.project_id === projectId
  );
  if (!stored) {
    return {
      data: null,
      error: {
        name: "PostgrestError",
        message: "Project team not found",
        details: "",
        hint: "",
        code: "PGRST116",
      } as PostgrestError,
    };
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ teammates: applyTeammateChanges(stored.teammates, changes) })
    .eq("id", projectId)
    .select(PROJECT_CLIENT_COLUMNS)
    .single();

  if (error) return { data: null, error };
  return { data: await withTeamEmails(data as unknown as Record<string, unknown>), error: null };
}
