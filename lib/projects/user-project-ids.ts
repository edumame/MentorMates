import type { createSupabaseClient } from "@/app/utils/supabase/server";

/**
 * Ids of the projects a user belongs to, as lead or teammate. Membership is
 * stored by email on projects (lead_email, teammates), not by user id.
 */
export async function fetchUserProjectIds(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  userEmail: string | null | undefined,
) {
  if (!userEmail) {
    return { projectIds: [] as string[], error: null };
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .or(`lead_email.eq.${userEmail},teammates.cs.{"${userEmail}"}`);

  return {
    projectIds: (data?.map((project) => project.id) || []) as string[],
    error,
  };
}
