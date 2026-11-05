import { supabase } from "@/lib/supabase";
import { Project } from "@/lib/types";
import {
  applyTeamChange,
  type TeamChange,
} from "@/features/projects/utils/teamChange";
import { PostgrestError } from "@supabase/supabase-js";

export async function updateProjectClient(
  projectId: string, 
  updateData: Partial<Project>
): Promise<{ data: Project | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("projects")
    .update(updateData)
    .eq("id", projectId)
    .select()
    .single();

  return { data, error };
}

export async function updateProjectTeamClient(
  projectId: string, 
  teammates: string[]
): Promise<{ data: Project | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("projects")
    .update({ teammates })
    .eq("id", projectId)
    .select()
    .single();

  return { data, error };
}

// Applies a change to the stored team instead of overwriting it, because the
// caller's copy can miss members who joined through an invite in the meantime.
export async function applyProjectTeamChangeClient(
  projectId: string,
  change: TeamChange
): Promise<{ data: Project | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("projects")
    .select("teammates")
    .eq("id", projectId)
    .single();

  if (error) {
    return { data: null, error };
  }

  return updateProjectTeamClient(
    projectId,
    applyTeamChange(data.teammates ?? [], change)
  );
}
