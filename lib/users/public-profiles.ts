import { createSupabaseServiceClient } from "@/lib/supabase/service";

// user_profiles RLS only lets admins, the row's owner and organizers of that
// user's events read a profile, so public pages can't resolve names with the
// viewer's client. These helpers read through the service client instead.
// Keep the selected columns display-safe, and only pass ids/emails the viewer
// is already allowed to see (e.g. from an RLS-scoped role or feed read).
// Team rosters by email use fetchTeamProfiles in lib/projects/team-members.

export type PublicProfile = {
  uid: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  affiliation: string | null;
};

export async function fetchPublicProfilesByIds(
  userIds: string[]
): Promise<Map<string, PublicProfile>> {
  if (userIds.length === 0) return new Map();

  try {
    const { data, error } = await createSupabaseServiceClient()
      .from("user_profiles")
      .select("uid, display_name, bio, avatar_url, affiliation")
      .in("uid", userIds);

    if (error) throw error;
    return new Map((data ?? []).map((profile) => [profile.uid, profile]));
  } catch (error) {
    // Service key may not exist in local dev; names are best-effort.
    console.error("Error fetching public profiles:", error);
    return new Map();
  }
}
