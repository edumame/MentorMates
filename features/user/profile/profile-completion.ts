/**
 * Profile "completion" for UX (notifications, account menu) is based on the same
 * required fields as the profile page checklist: affiliation, phone, LinkedIn.
 * This is separate from onboarding questionnaire completion (`onboarding_metadata`).
 */

export interface ProfileCompletionFields {
  affiliation: string | null;
  phone_number?: string | null;
  links?: Record<string, string> | null;
}

export function profileNeedsCompletion(
  userProfile: ProfileCompletionFields | null | undefined
): boolean {
  if (!userProfile) {
    return true;
  }
  const hasAffiliation = Boolean(userProfile.affiliation?.trim());
  const hasPhoneNumber = Boolean(userProfile.phone_number?.trim());
  const hasLinkedIn = Boolean(userProfile.links?.linkedin?.trim());
  return !hasAffiliation || !hasPhoneNumber || !hasLinkedIn;
}

export function getMissingProfileFieldLabels(
  userProfile: ProfileCompletionFields | null | undefined
): string[] {
  const missing: string[] = [];
  if (!userProfile?.affiliation?.trim()) {
    missing.push("affiliation");
  }
  if (!userProfile?.phone_number?.trim()) {
    missing.push("phone number");
  }
  if (!userProfile?.links?.linkedin?.trim()) {
    missing.push("LinkedIn");
  }
  return missing;
}

/**
 * Loads the fields profileNeedsCompletion checks. Phone numbers live in
 * user_phone_numbers (own rows readable under RLS), not user_profiles, so
 * reading only user_profiles made the "add your phone number" reminder
 * impossible to clear (MENT-019).
 */
export async function loadProfileCompletionFields(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  userId: string
): Promise<ProfileCompletionFields | null> {
  const [profileResult, phoneResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("affiliation, links")
      .eq("uid", userId)
      .maybeSingle(),
    supabase
      .from("user_phone_numbers")
      .select("phone_number")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (profileResult.error || !profileResult.data) return null;
  const phoneRows = (phoneResult.data ?? []) as Array<{ phone_number: string | null }>;
  return {
    affiliation: profileResult.data.affiliation ?? null,
    links: profileResult.data.links ?? null,
    phone_number: phoneRows[0]?.phone_number ?? null,
  };
}
