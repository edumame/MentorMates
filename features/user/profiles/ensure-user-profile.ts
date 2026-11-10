import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Initialize missing profiles without replacing a returning user's edits. */
export async function ensureUserProfile(client: SupabaseClient, user: User) {
  const { error } = await client.from("user_profiles").upsert(
    {
      uid: user.id,
      email: user.email,
      display_name: user.user_metadata?.full_name || user.email?.split("@")[0],
      created_at: user.created_at || new Date().toISOString(),
    },
    // The database resolves concurrent initializers atomically; existing rows
    // (including their display name and original creation date) are untouched.
    { onConflict: "uid", ignoreDuplicates: true }
  );
  return error ?? null;
}
