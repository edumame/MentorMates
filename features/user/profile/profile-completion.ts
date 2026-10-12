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
