import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { TeamProfile } from "@/lib/types";

// user_profiles RLS only lets admins, the row's owner and organizers of that
// user's events read a profile, so public pages can't resolve names with the
// viewer's client. These helpers read through the service client instead.
// Keep the selected columns display-safe, and only pass ids/emails the viewer
// is already allowed to see (e.g. from an RLS-scoped role or project read).

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

/**
 * Maps each lowercased email to its trimmed display fields, blanks as null.
 * Emails without a profile are omitted.
 */
export async function fetchTeamProfilesByEmails(
  emails: Array<string | null | undefined>
): Promise<Record<string, TeamProfile>> {
  const normalizedEmails = Array.from(
    new Set(emails.flatMap((email) => (email ? [email.toLowerCase()] : [])))
  );
  if (normalizedEmails.length === 0) return {};

  try {
    const { data, error } = await createSupabaseServiceClient()
      .from("user_profiles")
      .select("email, display_name, avatar_url, affiliation")
      .in("email", normalizedEmails);

    if (error) throw error;

    const profiles: Record<string, TeamProfile> = {};
    for (const row of data ?? []) {
      const email = row.email?.toLowerCase();
      if (!email) continue;
      profiles[email] = {
        display_name: row.display_name?.trim() || null,
        avatar_url: row.avatar_url?.trim() || null,
        affiliation: row.affiliation?.trim() || null,
      };
    }
    return profiles;
  } catch (error) {
    // Service key may not exist in local dev; profiles are best-effort.
    console.error("Error fetching team profiles:", error);
    return {};
  }
}
