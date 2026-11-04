import { supabase } from "@/lib/supabase";
import { Project } from "@/lib/types";
import { applyTeammateChanges, type TeammateChanges } from "@/lib/projects/teammates";
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
  changes: TeammateChanges
): Promise<{ data: Project | null; error: PostgrestError | null }> {
  const { data: stored, error: readError } = await supabase
    .from("projects")
    .select("teammates")
    .eq("id", projectId)
    .single();

  if (readError) {
    return { data: null, error: readError };
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ teammates: applyTeammateChanges(stored.teammates, changes) })
    .eq("id", projectId)
    .select()
    .single();

  return { data, error };
} 